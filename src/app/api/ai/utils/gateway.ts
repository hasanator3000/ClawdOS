import { withUser } from '@/lib/db'

/**
 * Get Clawdbot gateway configuration (URL + auth token)
 * @throws Error if CLAWDBOT_TOKEN is not set
 */
export function getGateway() {
  const url = process.env.CLAWDBOT_URL || 'http://127.0.0.1:18789'
  const token = process.env.CLAWDBOT_TOKEN
  if (!token) throw new Error('CLAWDBOT_TOKEN is not set')
  return { url: url.replace(/\/$/, ''), token }
}

/**
 * Get Telegram user ID for the current session user
 * @returns Telegram user ID or null if not linked
 */
export async function getTelegramUserIdForSessionUser(userId: string): Promise<string | null> {
  return withUser(userId, async (client) => {
    const res = await client.query('select telegram_user_id from core."user" where id=$1', [userId])
    return (res.rows[0]?.telegram_user_id as string | null) ?? null
  })
}
