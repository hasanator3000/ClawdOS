import { Pool, type PoolClient } from 'pg'
import { createLogger } from '@/lib/logger'

const log = createLogger('db')

let _pool: Pool | null = null

// Threshold for slow query warnings (matches Quality Gate: >100ms auto-warning)
const SLOW_QUERY_MS = 100

/** Extract query text from pool.query / client.query arguments */
function extractQueryText(args: unknown[]): string {
  if (typeof args[0] === 'string') return args[0]
  if (args[0] && typeof args[0] === 'object' && 'text' in args[0]) {
    return String((args[0] as { text: string }).text)
  }
  return 'unknown'
}

/** Wrap a query function to log slow queries (>100ms) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function wrapQueryFn(original: (...a: any[]) => any): (...a: any[]) => any {
  return (...args: unknown[]) => {
    const start = performance.now()
    const result = original(...args)
    // Only instrument the promise path (non-callback queries)
    if (result && typeof result === 'object' && typeof result.then === 'function') {
      return result.then((res: unknown) => {
        const durationMs = Math.round(performance.now() - start)
        if (durationMs > SLOW_QUERY_MS) {
          log.warn('Slow query', { durationMs, query: extractQueryText(args).slice(0, 200) })
        }
        return res
      })
    }
    return result
  }
}

/** Instrument both pool.query and pool.connect for slow query detection */
function instrumentSlowQueryLogging(pool: Pool): void {
  // Wrap pool.query for direct pool queries
  pool.query = wrapQueryFn(pool.query.bind(pool)) as typeof pool.query

  // Wrap pool.connect to instrument clients obtained for withUser()
  const originalConnect = pool.connect.bind(pool)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pool.connect = ((...args: any[]) => {
    // Callback form: connect(callback)
    if (args.length > 0 && typeof args[0] === 'function') {
      return originalConnect(args[0])
    }
    // Promise form: connect() -> Promise<PoolClient>
    return (originalConnect() as Promise<PoolClient>).then((client) => {
      client.query = wrapQueryFn(client.query.bind(client)) as typeof client.query
      return client
    })
  }) as typeof pool.connect
}

export function getPool() {
  if (_pool) return _pool
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL is not set')

  _pool = new Pool({
    connectionString: databaseUrl,
    // Prevent connection exhaustion under load
    max: 20,
    // Release idle connections after 30s
    idleTimeoutMillis: 30_000,
    // Fail fast if can't connect within 5s
    connectionTimeoutMillis: 5_000,
  })

  // --- Slow query instrumentation ---
  instrumentSlowQueryLogging(_pool)

  return _pool
}

export async function withUser<T>(userId: string, fn: (client: PoolClient) => Promise<T>) {
  const pool = getPool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    // Per-transaction setting used by RLS policies
    await client.query("select set_config('app.user_id', $1, true)", [userId])

    const out = await fn(client)

    await client.query('COMMIT')
    return out
  } catch (e) {
    try {
      await client.query('ROLLBACK')
    } catch {}
    throw e
  } finally {
    client.release()
  }
}

/**
 * Drain the connection pool gracefully.
 * Waits for active queries to finish, then closes all connections.
 */
export async function drainPool(): Promise<void> {
  if (!_pool) return
  log.info('Draining connection pool', {
    total: _pool.totalCount,
    idle: _pool.idleCount,
    waiting: _pool.waitingCount,
  })
  await _pool.end()
  _pool = null
  log.info('Connection pool drained')
}

export type { PoolClient }
