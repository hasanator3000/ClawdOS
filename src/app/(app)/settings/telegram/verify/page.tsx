import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { consumeAuthChallenge } from '@/lib/auth'
import { withUser } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function verify(formData: FormData) {
  'use server'

  const code = String(formData.get('code') || '').trim()
  const session = await getSession()

  const telegramUserId = (session as any).pendingTelegramUserId as string | undefined

  if (!session.userId || !session.pendingChallengeId || !telegramUserId) {
    redirect('/settings/telegram?error=Session%20expired')
  }

  const userId = await consumeAuthChallenge(session.pendingChallengeId, code, 'link')
  if (!userId || userId !== session.userId) {
    redirect('/settings/telegram/verify?error=Invalid%20or%20expired%20code')
  }

  await withUser(session.userId, async (client) => {
    await client.query('update core."user" set telegram_user_id=$2 where id=$1', [session.userId, telegramUserId])
  })

  session.pendingChallengeId = undefined
  ;(session as any).pendingTelegramUserId = undefined
  await session.save()

  redirect('/settings?ok=Telegram%20linked')
}

export default async function VerifyTelegramPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>
}) {
  const sp = (await searchParams) ?? {}
  const error = sp.error ?? null

  const session = await getSession()
  if (!session.userId) redirect('/login')
  if (!session.pendingChallengeId) redirect('/settings/telegram')

  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-xl font-semibold">Verify Telegram link</h1>
      <p className="text-sm text-[var(--muted)]">Enter the code we sent to Telegram.</p>

      {error ? <div className="rounded-lg bg-red-50 text-red-700 text-sm p-3">{error}</div> : null}

      <form className="space-y-3" action={verify}>
        <label className="block">
          <span className="text-sm text-[var(--muted-2)]">Code</span>
          <input
            name="code"
            required
            className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-[var(--input-fg)] placeholder:text-[var(--input-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            placeholder="123456"
            inputMode="numeric"
            autoComplete="one-time-code"
          />
        </label>

        <button className="w-full rounded-md bg-[var(--fg)] text-[var(--bg)] py-2">Confirm</button>
      </form>
    </div>
  )
}
