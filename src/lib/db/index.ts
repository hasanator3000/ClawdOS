import { Pool, type PoolClient } from 'pg'
import { createLogger } from '@/lib/logger'

const log = createLogger('db')

let _pool: Pool | null = null

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
