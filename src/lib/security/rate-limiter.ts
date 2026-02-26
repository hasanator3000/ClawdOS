/**
 * In-memory sliding window rate limiter.
 *
 * Tracks request timestamps per key (IP address) and rejects
 * requests exceeding the configured threshold within the window.
 *
 * Bounded memory: MAX_STORE_SIZE caps total tracked IPs.
 * When exceeded, oldest entries are evicted during cleanup.
 *
 * Edge-runtime compatible: uses only Map, Date.now(), setInterval.
 * No external dependencies.
 *
 * For a single-instance deployment (systemd) this is sufficient.
 * If horizontal scaling is needed, swap for Redis-backed limiter.
 */

const MAX_REQUESTS = 10
const WINDOW_MS = 1000 // 1 second
const MAX_STORE_SIZE = 10_000 // max tracked IPs before forced eviction
const CLEANUP_INTERVAL_MS = 60_000

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

  // Trigger eviction if store exceeds size cap (non-blocking)
  if (store.size > MAX_STORE_SIZE) {
    evictOldest()
  }

  return {
    allowed: true,
    limit: MAX_REQUESTS,
    remaining: MAX_REQUESTS - valid.length,
    resetMs: WINDOW_MS,
  }
}

/**
 * Evict oldest entries until store is within MAX_STORE_SIZE.
 * Map iteration order is insertion order, so oldest entries come first.
 */
function evictOldest(): void {
  const excess = store.size - MAX_STORE_SIZE
  if (excess <= 0) return

  let removed = 0
  for (const key of store.keys()) {
    if (removed >= excess) break
    store.delete(key)
    removed++
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
  setInterval(cleanup, CLEANUP_INTERVAL_MS)
}
