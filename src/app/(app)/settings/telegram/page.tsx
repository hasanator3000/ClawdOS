import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createAuthChallenge, enqueueTelegram } from '@/lib/auth'
import { withUser } from '@/lib/db'
import { createLogger } from '@/lib/logger'

const log = createLogger('telegram-link')

export const dynamic = 'force-dynamic'

async function startLink(formData: FormData) {
  'use server'

  const telegramUserId = String(formData.get('telegram_user_id') || '').trim()
  log.info('startLink called', { telegramUserId })

  const session = await getSession()
  if (!session.userId) redirect('/login')

  if (!/^[0-9]{5,20}$/.test(telegramUserId)) {
    log.error('Invalid telegram_user_id format', { telegramUserId })
    redirect('/settings/telegram?error=Invalid%20telegram%20user%20id')
  }

  log.info('Creating auth challenge')
  const ch = await createAuthChallenge(session.userId, 'link')
  log.info('Challenge created', { challengeId: ch.id, code: ch.code })

  log.info('Enqueueing Telegram message')
  try {
    await enqueueTelegram(telegramUserId, `ClawdOS link code: ${ch.code} (valid 10 min)`)
    log.info('Message enqueued successfully')
  } catch (error) {
    log.error('Failed to enqueue message', { error: error instanceof Error ? error.message : String(error) })
    throw error
  }

  session.pendingChallengeId = ch.id
  ;(session as any).pendingTelegramUserId = telegramUserId
  await session.save()

  log.info('Redirecting to verify page')
  redirect('/settings/telegram/verify')
}

export default async function TelegramSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>
}) {
  const sp = (await searchParams) ?? {}
  const error = sp.error ?? null

  const session = await getSession()
  if (!session.userId) redirect('/login')

  const current = await withUser(session.userId, async (client) => {
    const r = await client.query('select telegram_user_id from core."user" where id=$1', [session.userId])
    return (r.rows[0]?.telegram_user_id as string | null) ?? null
  })

  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-xl font-semibold">Link Telegram</h1>
      <p className="text-sm text-[var(--muted)]">
        Current: {current ? <span className="text-[var(--muted-2)]">{current}</span> : 'not linked'}
      </p>

      {error ? <div className="rounded-lg bg-[var(--error-bg)] text-[var(--error-fg)] text-sm p-3">{error}</div> : null}

      <form className="space-y-3" action={startLink}>
        <label className="block">
          <span className="text-sm text-[var(--muted-2)]">Telegram user id</span>
          <input
            name="telegram_user_id"
            required
            className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-[var(--input-fg)] placeholder:text-[var(--input-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            placeholder="610189212"
            inputMode="numeric"
          />
        </label>

        <button className="w-full rounded-md bg-[var(--fg)] text-[var(--bg)] py-2 hover:opacity-90 transition-opacity">Send code</button>
      </form>

      <p className="text-sm text-[var(--muted)]">
        We will send a code to that Telegram user id. Enter it on the next step to confirm linking.
      </p>
    </div>
  )
}
