import argon2 from 'argon2'
import { findUserByUsername, updateUserPassword } from '@/lib/db/repositories/user.repository'
import type { User } from '@/types/user'

export const usernameRegex = /^[a-zA-Z0-9._-]{2,32}$/

export async function verifyUser(username: string, password: string): Promise<User | null> {
  const row = await findUserByUsername(username)
  if (!row) return null

  const ok = await argon2.verify(row.password_hash, password)
  if (!ok) return null

  return { id: row.id, username: row.username, telegramUserId: row.telegram_user_id }
}

export async function updatePassword(userId: string, newPassword: string): Promise<void> {
  const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id })
  await updateUserPassword(userId, passwordHash)
}

export async function verifyPassword(userId: string, password: string): Promise<boolean> {
  const pool = (await import('@/lib/db')).getPool()
  const res = await pool.query('select password_hash from core."user" where id = $1', [userId])
  const row = res.rows[0] as { password_hash: string } | undefined
  if (!row) return false
  return argon2.verify(row.password_hash, password)
}
