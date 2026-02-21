/**
 * Generic in-memory cache with TTL eviction.
 *
 * - Lazy eviction: expired entries are cleaned on read
 * - Periodic sweep: runs every sweepInterval to prevent memory leaks
 * - Bounded: maxEntries cap with LRU-like eviction (oldest first)
 */

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

interface CacheOptions {
  /** TTL in milliseconds (default: 5 minutes) */
  ttl?: number
  /** Maximum number of entries (default: 1000) */
  maxEntries?: number
  /** Interval for periodic cleanup in ms (default: 60s) */
  sweepInterval?: number
}

export class MemoryCache<T> {
  private store = new Map<string, CacheEntry<T>>()
  private readonly ttl: number
  private readonly maxEntries: number
  private sweepTimer: ReturnType<typeof setInterval> | null = null

  constructor(opts: CacheOptions = {}) {
    this.ttl = opts.ttl ?? 5 * 60 * 1000
    this.maxEntries = opts.maxEntries ?? 1000

    const sweepInterval = opts.sweepInterval ?? 60_000
    // Periodic sweep to clean expired entries
    this.sweepTimer = setInterval(() => this.sweep(), sweepInterval)
    // Don't keep process alive just for cache cleanup
    if (this.sweepTimer.unref) this.sweepTimer.unref()
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key)
    if (!entry) return undefined

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return undefined
    }

    return entry.value
  }

  set(key: string, value: T, ttlOverride?: number): void {
    // Evict oldest if at capacity
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      const oldest = this.store.keys().next().value
      if (oldest !== undefined) this.store.delete(oldest)
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + (ttlOverride ?? this.ttl),
    })
  }

  has(key: string): boolean {
    return this.get(key) !== undefined
  }

  delete(key: string): void {
    this.store.delete(key)
  }

  clear(): void {
    this.store.clear()
  }

  get size(): number {
    return this.store.size
  }

  /** Remove all expired entries */
  private sweep(): void {
    const now = Date.now()
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key)
      }
    }
  }

  /** Cleanup timer (call on shutdown) */
  destroy(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer)
      this.sweepTimer = null
    }
    this.store.clear()
  }
}
