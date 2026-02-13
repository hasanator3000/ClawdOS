import { parseFeed } from './parser'

export interface ValidationResult {
  valid: boolean
  feedTitle: string | null
  feedType: 'rss' | 'atom' | 'json' | null
  itemCount: number
  error?: string
}

/**
 * Validate that a URL points to a working RSS/Atom/JSON feed.
 * Does not write to DB — purely inspects the feed.
 */
export async function validateFeedUrl(url: string): Promise<ValidationResult> {
  // Basic URL format check
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, feedTitle: null, feedType: null, itemCount: 0, error: 'URL must use http or https' }
    }
  } catch {
    return { valid: false, feedTitle: null, feedType: null, itemCount: 0, error: 'Invalid URL format' }
  }

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'ClawdOS/1.0 (RSS Reader)' },
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) {
      return {
        valid: false,
        feedTitle: null,
        feedType: null,
        itemCount: 0,
        error: `HTTP ${response.status} ${response.statusText}`,
      }
    }

    const text = await response.text()
    const feed = parseFeed(text, url)

    return {
      valid: true,
      feedTitle: feed.title,
      feedType: feed.feedType,
      itemCount: feed.items.length,
    }
  } catch (err) {
    return {
      valid: false,
      feedTitle: null,
      feedType: null,
      itemCount: 0,
      error: err instanceof Error ? err.message : 'Failed to fetch or parse feed',
    }
  }
}
