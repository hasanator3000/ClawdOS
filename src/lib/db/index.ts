import { Pool, type PoolClient } from 'pg'

let _pool: Pool | null = null

export function getPool() {
  if (_pool) return _pool
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL is not set')
  _pool = new Pool({ connectionString: databaseUrl })
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

export type { PoolClient }
