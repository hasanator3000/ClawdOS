import { sendTelegramMessage, sendTelegramCode as sendCode } from '@/lib/telegram/send'
import { createLogger } from '@/lib/logger'

const log = createLogger('auth')

/**
 * Send a 2FA code via Telegram (direct Bot API, no Clawdbot)
 */
export async function sendTelegramCode(telegramUserId: string | number, code: string, purpose: string) {
  log.info('sendTelegramCode called', { telegramUserId, purpose })
  const success = await sendCode(telegramUserId, code, purpose)
  if (!success) {
    log.error('sendTelegramCode failed')
    throw new Error('Failed to send Telegram code')
  }
  log.info('sendTelegramCode succeeded')
}

/**
 * Send a generic message via Telegram
 */
export async function enqueueTelegram(telegramUserId: string | number, message: string) {
  log.info('enqueueTelegram called', { telegramUserId, messagePreview: message.substring(0, 50) })
  const success = await sendTelegramMessage(telegramUserId, message)
  if (!success) {
    log.error('enqueueTelegram failed')
    throw new Error('Failed to send Telegram message')
  }
  log.info('enqueueTelegram succeeded')
}
