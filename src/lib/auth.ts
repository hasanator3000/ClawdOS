import argon2 from 'argon2'
import { getPool } from '@/lib/db'

export const usernameRegex = /^[a-zA-Z0-9._-]{2,32}$/

// NOTE: Local auth lives in Postgres table core."user" (compat views also exist in public.*).
// We do NOT use Supabase auth schema here.

export async function verifyUser(username: string, password: string) {
  const pool = getPool()
  const res = await pool.query(
    'select id, username, password_hash from core."user" where username = $1',
    [username]
  )
  const row = res.rows[0] as { id: string; username: string; password_hash: string } | undefined
  if (!row) return null

  const ok = await argon2.verify(row.password_hash, password)
  if (!ok) return null
  return { id: row.id, username: row.username }
}
