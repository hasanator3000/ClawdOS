/**
 * In-memory sliding window rate limiter.
 *
 * Tracks request timestamps per key (IP address) and rejects
 * requests exceeding the configured threshold within the window.
 *
 * Edge-runtime compatible: uses only Map, Date.now(), setInterval.
 * No external dependencies.
 */

const MAX_REQUESTS = 10
const WINDOW_MS = 1000 // 1 second

export type RateLimitResult = {
  allowed: boolean
  limit: number
  remaining: number
  resetMs: number // ms until window resets
}

// Store: key (IP) -> array of request timestamps (Date.now())
const store = new Map<string, number[]>()

/**
 * Check whether a request from `key` is within the rate limit.
 *
 * Sliding window: only timestamps within the last WINDOW_MS are counted.
 * If the count exceeds MAX_REQUESTS, the request is rejected.
 */
export function checkRateLimit(key: string): RateLimitResult {
  const now = Date.now()
  const timestamps = store.get(key) ?? []

  // Keep only timestamps within the current window
  const valid = timestamps.filter((t) => now - t < WINDOW_MS)

  if (valid.length >= MAX_REQUESTS) {
    // Oldest valid timestamp determines when the window resets
    const resetMs = WINDOW_MS - (now - valid[0])
    store.set(key, valid)
    return { allowed: false, limit: MAX_REQUESTS, remaining: 0, resetMs }
  }

  // Record this request
  valid.push(now)
  store.set(key, valid)

  return {
    allowed: true,
    limit: MAX_REQUESTS,
    remaining: MAX_REQUESTS - valid.length,
    resetMs: WINDOW_MS,
  }
}

/**
 * Periodic cleanup: remove entries where all timestamps have expired.
 * Runs every 60 seconds to prevent unbounded memory growth from unique IPs.
 */
function cleanup(): void {
  const now = Date.now()
  const keysToDelete: string[] = []
  store.forEach((timestamps, key) => {
    const valid = timestamps.filter((t) => now - t < WINDOW_MS)
    if (valid.length === 0) {
      keysToDelete.push(key)
    } else {
      store.set(key, valid)
    }
  })
  keysToDelete.forEach((key) => store.delete(key))
}

// Start cleanup interval (safe in Edge runtime)
// The typeof check prevents issues in test environments without timers
if (typeof setInterval !== 'undefined') {
  setInterval(cleanup, 60_000)
}
