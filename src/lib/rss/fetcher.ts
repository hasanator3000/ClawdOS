import type { PoolClient } from 'pg'
import type { NewsSource } from '@/types/news'
import { parseFeed, type ParsedFeed } from './parser'
import { batchUpsertNewsItems, cleanupOldItems } from '@/lib/db/repositories/news.repository'
import {
  markSourceFetched,
  incrementSourceError,
} from '@/lib/db/repositories/news-source.repository'
import { MemoryCache } from '@/lib/cache'
import { createLogger } from '@/lib/logger'

const log = createLogger('rss')

// Cache parsed feed results for 5 minutes to avoid re-fetching the same URL
// when multiple workspaces share the same source or rapid refresh is triggered.
const feedCache = new MemoryCache<ParsedFeed>({ ttl: 5 * 60 * 1000, maxEntries: 200 })

export interface FetchResult {
  sourceId: string
  sourceTitle: string | null
  newItems: number
  error?: string
}

/** Max concurrent HTTP fetches */
const HTTP_CONCURRENCY = 5

/**
 * Fetch a single RSS source, parse items, and upsert into DB.
 * Individual source failures are caught and recorded — never throws.
 */
export async function fetchSource(
  client: PoolClient,
  source: NewsSource,
  workspaceId: string
): Promise<FetchResult> {
  const result: FetchResult = {
    sourceId: source.id,
    sourceTitle: source.title,
    newItems: 0,
  }

  try {
    const response = await fetch(source.url, {
      headers: { 'User-Agent': 'ClawdOS/1.0 (RSS Reader)' },
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`)
    }

    const text = await response.text()
    const feed = parseFeed(text, source.url)

    // Update source title if not set yet
    if (!source.title && feed.title) {
      await client.query(
        'update content.news_source set title = $1 where id = $2 and title is null',
        [feed.title, source.id]
      )
    }

    // Batch upsert all items at once
    result.newItems = await batchUpsertNewsItems(
      client,
      feed.items.map((item) => ({
        workspaceId,
        sourceId: source.id,
        title: item.title,
        url: item.url,
        summary: item.summary,
        imageUrl: item.imageUrl,
        publishedAt: item.publishedAt?.toISOString() ?? null,
        guid: item.guid,
      }))
    )

    // Cleanup old items (max 200 per source, max 30 days)
    await cleanupOldItems(client, source.id, 200, 30)

    // Mark success
    await markSourceFetched(client, source.id)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    result.error = message
    await incrementSourceError(client, source.id, message).catch(() => {})
  }

  return result
}

/**
 * Refresh all stale sources for a workspace.
 *
 * Phase 1: Fetch all HTTP responses in parallel (network I/O).
 * Phase 2: Process DB writes sequentially (single client connection).
 */
export async function refreshStaleSources(
  client: PoolClient,
  workspaceId: string,
  staleMinutes: number = 15
): Promise<FetchResult[]> {
  const { findStaleSources } = await import('@/lib/db/repositories/news-source.repository')
  const sources = await findStaleSources(client, workspaceId, staleMinutes)

  if (sources.length === 0) return []

  log.info('Refreshing stale sources', { workspace: workspaceId, count: sources.length })

  // Phase 1: Parallel HTTP fetches with concurrency limit (uses feed cache)
  type FeedData = { source: NewsSource; feed: ParsedFeed }
  type FeedError = { source: NewsSource; error: string }
  const feedResults: Array<FeedData | FeedError> = []

  for (let i = 0; i < sources.length; i += HTTP_CONCURRENCY) {
    const batch = sources.slice(i, i + HTTP_CONCURRENCY)
    const settled = await Promise.allSettled(
      batch.map(async (source): Promise<FeedData> => {
        // Check cache first — avoids re-fetching same URL across workspaces
        const cached = feedCache.get(source.url)
        if (cached) {
          log.debug('Feed cache hit', { url: source.url })
          return { source, feed: cached }
        }

        const response = await fetch(source.url, {
          headers: { 'User-Agent': 'ClawdOS/1.0 (RSS Reader)' },
          signal: AbortSignal.timeout(10_000),
        })
        if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`)
        const text = await response.text()
        const feed = parseFeed(text, source.url)

        // Cache the parsed feed
        feedCache.set(source.url, feed)

        return { source, feed }
      })
    )

    for (let j = 0; j < settled.length; j++) {
      const r = settled[j]
      if (r.status === 'fulfilled') {
        feedResults.push(r.value)
      } else {
        feedResults.push({
          source: batch[j],
          error: r.reason instanceof Error ? r.reason.message : String(r.reason),
        })
      }
    }
  }

  // Phase 2: Sequential DB writes (single connection, savepoints for isolation)
  const results: FetchResult[] = []

  for (const data of feedResults) {
    await client.query('SAVEPOINT fetch_source')
    try {
      if ('error' in data) {
        throw new Error(data.error)
      }

      const { source, feed } = data

      // Update source title if not set yet
      if (!source.title && feed.title) {
        await client.query(
          'update content.news_source set title = $1 where id = $2 and title is null',
          [feed.title, source.id]
        )
      }

      // Batch insert all items
      const newItems = await batchUpsertNewsItems(
        client,
        feed.items.map((item) => ({
          workspaceId,
          sourceId: source.id,
          title: item.title,
          url: item.url,
          summary: item.summary,
          imageUrl: item.imageUrl,
          publishedAt: item.publishedAt?.toISOString() ?? null,
          guid: item.guid,
        }))
      )

      await cleanupOldItems(client, source.id, 200, 30)
      await markSourceFetched(client, source.id)
      await client.query('RELEASE SAVEPOINT fetch_source')

      results.push({ sourceId: source.id, sourceTitle: source.title, newItems })
    } catch (err) {
      await client.query('ROLLBACK TO SAVEPOINT fetch_source')
      const msg = err instanceof Error ? err.message : String(err)
      await incrementSourceError(client, data.source.id, msg).catch(() => {})
      results.push({ sourceId: data.source.id, sourceTitle: data.source.title, newItems: 0, error: msg })
    }
  }

  return results
}
