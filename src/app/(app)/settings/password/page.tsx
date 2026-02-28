import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { verifyUser, updatePassword, createAuthChallenge, enqueueTelegram } from '@/lib/auth'

export const dynamic = 'force-dynamic'

async function startPasswordChange(formData: FormData) {
  'use server'

  const current = String(formData.get('current') || '')
  const next = String(formData.get('next') || '')
  const confirm = String(formData.get('confirm') || '')

  const session = await getSession()
  if (!session.userId || !session.username) redirect('/login')

  if (next.length < 10) redirect('/settings/password?error=Password%20too%20short')
  if (next !== confirm) redirect('/settings/password?error=Passwords%20do%20not%20match')

  const user = await verifyUser(session.username, current)
  if (!user) redirect('/settings/password?error=Invalid%20current%20password')

  // If Telegram is linked, require a confirmation code.
  if (user.telegramUserId) {
    const ch = await createAuthChallenge(user.id, 'recovery')
    await enqueueTelegram(user.telegramUserId, `ClawdOS password change code: ${ch.code} (valid 10 min)`)

    session.pendingUserId = user.id
    session.pendingUsername = session.username
    session.pendingChallengeId = ch.id
    // stash new password temporarily in cookie session (encrypted by iron-session)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- iron-session extended field
  ;(session as any).pendingNewPassword = next
    await session.save()

    redirect('/settings/password/verify')
  }

  await updatePassword(user.id, next)
  redirect('/settings?ok=Password%20updated')
}

export default async function PasswordSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>
}) {
  const sp = (await searchParams) ?? {}
  const error = sp.error ?? null

  const session = await getSession()
  if (!session.userId) redirect('/login')

  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-xl font-semibold">Change password</h1>
      {error ? <div className="rounded-lg bg-[var(--error-bg)] text-[var(--error-fg)] text-sm p-3">{error}</div> : null}

      <form className="space-y-3" action={startPasswordChange}>
        <label className="block">
          <span className="text-sm text-[var(--muted-2)]">Current password</span>
          <input
            name="current"
            type="password"
            required
            className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-[var(--input-fg)] placeholder:text-[var(--input-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </label>

        <label className="block">
          <span className="text-sm text-[var(--muted-2)]">New password</span>
          <input
            name="next"
            type="password"
            required
            className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-[var(--input-fg)] placeholder:text-[var(--input-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </label>

        <label className="block">
          <span className="text-sm text-[var(--muted-2)]">Confirm new password</span>
          <input
            name="confirm"
            type="password"
            required
            className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-[var(--input-fg)] placeholder:text-[var(--input-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </label>

        <button className="w-full rounded-md bg-[var(--fg)] text-[var(--bg)] py-2 hover:opacity-90 transition-opacity">Continue</button>
      </form>

      <p className="text-sm text-[var(--muted)]">
        If Telegram is linked, you will be asked for a confirmation code.
      </p>
    </div>
  )
}
