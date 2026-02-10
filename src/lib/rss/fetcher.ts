import type { PoolClient } from 'pg'
import type { NewsSource } from '@/types/news'
import { parseFeed } from './parser'
import { upsertNewsItem, cleanupOldItems } from '@/lib/db/repositories/news.repository'
import {
  markSourceFetched,
  incrementSourceError,
} from '@/lib/db/repositories/news-source.repository'

export interface FetchResult {
  sourceId: string
  sourceTitle: string | null
  newItems: number
  error?: string
}

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
      headers: { 'User-Agent': 'LifeOS/1.0 (RSS Reader)' },
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

    // Upsert each item (dedup by guid)
    for (const item of feed.items) {
      const inserted = await upsertNewsItem(client, {
        workspaceId,
        sourceId: source.id,
        title: item.title,
        url: item.url,
        summary: item.summary,
        publishedAt: item.publishedAt?.toISOString() ?? null,
        guid: item.guid,
      })
      if (inserted) result.newItems++
    }

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
 * Each source is fetched independently — one failure doesn't block others.
 */
export async function refreshStaleSources(
  client: PoolClient,
  workspaceId: string,
  staleMinutes: number = 15
): Promise<FetchResult[]> {
  const { findStaleSources } = await import('@/lib/db/repositories/news-source.repository')
  const sources = await findStaleSources(client, workspaceId, staleMinutes)

  const results: FetchResult[] = []
  for (const source of sources) {
    const result = await fetchSource(client, source, workspaceId)
    results.push(result)
  }

  return results
}
