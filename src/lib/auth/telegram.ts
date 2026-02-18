import { sendTelegramMessage, sendTelegramCode as sendCode } from '@/lib/telegram/send'

/**
 * Send a 2FA code via Telegram (direct Bot API, no Clawdbot)
 */
export async function sendTelegramCode(telegramUserId: string | number, code: string, purpose: string) {
  console.log('[Auth] sendTelegramCode called', { telegramUserId, purpose })
  const success = await sendCode(telegramUserId, code, purpose)
  if (!success) {
    console.error('[Auth] sendTelegramCode failed')
    throw new Error('Failed to send Telegram code')
  }
  console.log('[Auth] sendTelegramCode succeeded')
}

/**
 * Send a generic message via Telegram
 */
export async function enqueueTelegram(telegramUserId: string | number, message: string) {
  console.log('[Auth] enqueueTelegram called', { telegramUserId, messagePreview: message.substring(0, 50) })
  const success = await sendTelegramMessage(telegramUserId, message)
  if (!success) {
    console.error('[Auth] enqueueTelegram failed')
    throw new Error('Failed to send Telegram message')
  }
  console.log('[Auth] enqueueTelegram succeeded')
}
