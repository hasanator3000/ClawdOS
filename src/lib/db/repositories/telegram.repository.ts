import { getPool } from '../index'

export async function enqueueTelegramMessage(telegramUserId: string | number, message: string) {
  const pool = getPool()
  await pool.query('insert into core.telegram_outbox (telegram_user_id, message) values ($1,$2)', [
    telegramUserId,
    message,
  ])
}
