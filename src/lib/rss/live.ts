import type { NewsItem, NewsSource } from '@/types/news'
import { parseFeed } from './parser'

const HTTP_CONCURRENCY = 5
const FETCH_TIMEOUT = 10_000
const PAGE_LOAD_TIMEOUT = 5_000  // Max time to wait for feeds before rendering
const ITEMS_PER_SOURCE = 15      // Limit items per source to reduce load

/**
 * Fetch all RSS sources live (no DB storage), merge, sort by date.
 * Returns NewsItem[] ready for the UI.
 * Uses timeout to prevent page hang — returns partial results if slow.
 */
export async function fetchLiveFeeds(sources: NewsSource[]): Promise<NewsItem[]> {
  const active = sources.filter((s) => s.status === 'active')
  if (active.length === 0) return []

  const allItems: NewsItem[] = []
  let timedOut = false

  // Race against timeout
  const fetchPromise = (async () => {
    // Fetch in batches to limit concurrency
    for (let i = 0; i < active.length; i += HTTP_CONCURRENCY) {
      if (timedOut) break

      const batch = active.slice(i, i + HTTP_CONCURRENCY)
      const settled = await Promise.allSettled(
        batch.map((source) => fetchSingleFeed(source))
      )

      for (const result of settled) {
        if (result.status === 'fulfilled') {
          allItems.push(...result.value)
        }
        // Silently skip failed feeds
      }
    }
  })()

  const timeoutPromise = new Promise<void>((resolve) => {
    setTimeout(() => {
      timedOut = true
      resolve()
    }, PAGE_LOAD_TIMEOUT)
  })

  // Wait for fetch or timeout, whichever comes first
  await Promise.race([fetchPromise, timeoutPromise])

  // Sort by published date descending
  allItems.sort((a, b) => {
    const da = a.publishedAt ? new Date(a.publishedAt).getTime() : 0
    const db = b.publishedAt ? new Date(b.publishedAt).getTime() : 0
    return db - da
  })

  return allItems
}

async function fetchSingleFeed(source: NewsSource): Promise<NewsItem[]> {
  const response = await fetch(source.url, {
    headers: { 'User-Agent': 'LifeOS/1.0 (RSS Reader)' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  })

  if (!response.ok) return []

  const text = await response.text()
  const feed = parseFeed(text, source.url)

  // Limit to ITEMS_PER_SOURCE to reduce load
  return feed.items.slice(0, ITEMS_PER_SOURCE).map((item) => ({
    id: item.guid,
    title: item.title,
    url: item.url,
    topic: null,
    summary: item.summary,
    imageUrl: item.imageUrl,
    publishedAt: item.publishedAt?.toISOString() ?? null,
    sourceId: source.id,
    guid: item.guid,
    sourceName: source.title || feed.title || new URL(source.url).hostname,
  }))
}
