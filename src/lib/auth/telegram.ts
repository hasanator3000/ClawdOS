import { sendTelegramMessage, sendTelegramCode as sendCode } from '@/lib/telegram/send'

/**
 * Send a 2FA code via Telegram (direct Bot API, no Clawdbot)
 */
export async function sendTelegramCode(telegramUserId: string | number, code: string, purpose: string) {
  const success = await sendCode(telegramUserId, code, purpose)
  if (!success) {
    throw new Error('Failed to send Telegram code')
  }
}

/**
 * Send a generic message via Telegram
 */
export async function enqueueTelegram(telegramUserId: string | number, message: string) {
  const success = await sendTelegramMessage(telegramUserId, message)
  if (!success) {
    throw new Error('Failed to send Telegram message')
  }
}
