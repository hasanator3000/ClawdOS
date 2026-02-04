import { enqueueTelegramMessage } from '@/lib/db/repositories/telegram.repository'

export async function sendTelegramCode(telegramUserId: string | number, code: string, purpose: string) {
  await enqueueTelegramMessage(telegramUserId, `LifeOS ${purpose} code: ${code} (valid 10 min)`)
}

export { enqueueTelegramMessage as enqueueTelegram }
