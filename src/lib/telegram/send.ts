/**
 * Direct Telegram Bot API integration (no Clawdbot dependency)
 * Send messages directly via api.telegram.org
 */

const TELEGRAM_API_BASE = 'https://api.telegram.org'

interface SendMessageParams {
  chat_id: string | number
  text: string
  parse_mode?: 'Markdown' | 'HTML'
}

interface TelegramResponse {
  ok: boolean
  result?: unknown
  description?: string
}

/**
 * Send a message via Telegram Bot API
 * @param telegramUserId - Telegram user ID (chat_id)
 * @param message - Message text to send
 * @returns true if sent successfully, false otherwise
 */
export async function sendTelegramMessage(
  telegramUserId: string | number,
  message: string
): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN

  if (!botToken) {
    console.error('[Telegram] TELEGRAM_BOT_TOKEN not configured')
    return false
  }

  const url = `${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`

  const params: SendMessageParams = {
    chat_id: telegramUserId,
    text: message,
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(10_000), // 10s timeout
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error(`[Telegram] Failed to send message: ${response.status} - ${errorText}`)
      return false
    }

    const data = (await response.json()) as TelegramResponse

    if (!data.ok) {
      console.error(`[Telegram] API returned error: ${data.description}`)
      return false
    }

    console.log(`[Telegram] Message sent successfully to user ${telegramUserId}`)
    return true
  } catch (error) {
    if (error instanceof Error) {
      console.error(`[Telegram] Error sending message: ${error.message}`)
    }
    return false
  }
}

/**
 * Send a 2FA/auth code to Telegram
 * @param telegramUserId - Telegram user ID
 * @param code - 6-digit code
 * @param purpose - Purpose description (login, link, password reset, etc.)
 */
export async function sendTelegramCode(
  telegramUserId: string | number,
  code: string,
  purpose: string
): Promise<boolean> {
  const message = `LifeOS ${purpose} code: ${code} (valid 10 min)`
  return sendTelegramMessage(telegramUserId, message)
}
