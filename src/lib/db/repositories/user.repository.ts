import type { PoolClient } from 'pg'
import { getPool } from '../index'
import type { UserProfile } from '@/types/user'

export async function findUserByUsername(username: string) {
  const pool = getPool()
  const res = await pool.query(
    'select id, username, password_hash, telegram_user_id from core."user" where username = $1',
    [username]
  )
  return res.rows[0] as
    | { id: string; username: string; password_hash: string; telegram_user_id: string | null }
    | undefined
}

export async function updateUserPassword(userId: string, passwordHash: string) {
  const pool = getPool()
  await pool.query('update core."user" set password_hash=$2, password_updated_at=now() where id=$1', [
    userId,
    passwordHash,
  ])
}

export async function getUserProfile(client: PoolClient, userId: string): Promise<UserProfile | undefined> {
  const res = await client.query(
    'select telegram_user_id as "telegramUserId", password_updated_at as "passwordUpdatedAt", created_at as "createdAt" from core."user" where id=$1',
    [userId]
  )
  return res.rows[0] as UserProfile | undefined
}

export async function linkTelegramUser(userId: string, telegramUserId: string) {
  const pool = getPool()
  await pool.query('update core."user" set telegram_user_id=$2 where id=$1', [userId, telegramUserId])
}

export async function findUserByTelegramId(telegramUserId: string) {
  const pool = getPool()
  const res = await pool.query('select id, username from core."user" where telegram_user_id = $1', [telegramUserId])
  return res.rows[0] as { id: string; username: string } | undefined
}
