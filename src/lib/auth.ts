import argon2 from 'argon2'
import { getPool } from '@/lib/db'

export const usernameRegex = /^[a-zA-Z0-9._-]{2,32}$/

// NOTE: Local auth lives in Postgres table core."user" (compat views also exist in public.*).
// We do NOT use Supabase auth schema here.

export async function verifyUser(username: string, password: string) {
  const pool = getPool()
  const res = await pool.query(
    'select id, username, password_hash, telegram_user_id from core."user" where username = $1',
    [username]
  )
  const row = res.rows[0] as
    | { id: string; username: string; password_hash: string; telegram_user_id: string | null }
    | undefined
  if (!row) return null

  const ok = await argon2.verify(row.password_hash, password)
  if (!ok) return null
  return { id: row.id, username: row.username, telegramUserId: row.telegram_user_id }
}

function generateCode(len = 6) {
  // numeric code
  const digits = '0123456789'
  let out = ''
  for (let i = 0; i < len; i++) out += digits[Math.floor(Math.random() * digits.length)]
  return out
}

export async function createAuthChallenge(userId: string, kind: 'login' | 'recovery' | 'link') {
  const pool = getPool()
  const code = generateCode(6)
  const res = await pool.query(
    `insert into core.auth_challenge (user_id, kind, code, expires_at)
     values ($1,$2,$3, now() + interval '10 minutes')
     returning id, expires_at`,
    [userId, kind, code]
  )
  return { id: res.rows[0].id as string, code, expiresAt: res.rows[0].expires_at as string }
}

export async function consumeAuthChallenge(id: string, code: string, kind: 'login' | 'recovery' | 'link') {
  const pool = getPool()
  const res = await pool.query(
    `update core.auth_challenge
     set consumed_at = now()
     where id = $1
       and kind = $2
       and consumed_at is null
       and expires_at > now()
       and code = $3
     returning user_id`,
    [id, kind, code]
  )
  return (res.rows[0]?.user_id as string | undefined) ?? null
}

export async function enqueueTelegram(telegramUserId: string | number, message: string) {
  const pool = getPool()
  await pool.query('insert into core.telegram_outbox (telegram_user_id, message) values ($1,$2)', [
    telegramUserId,
    message,
  ])
}

export async function updatePassword(userId: string, newPassword: string) {
  const pool = getPool()
  const password_hash = await argon2.hash(newPassword, { type: argon2.argon2id })
  await pool.query('update core."user" set password_hash=$2, password_updated_at=now() where id=$1', [
    userId,
    password_hash,
  ])
}
