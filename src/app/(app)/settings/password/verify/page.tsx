import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { consumeAuthChallenge, updatePassword } from '@/lib/auth'

export const dynamic = 'force-dynamic'

async function verify(formData: FormData) {
  'use server'

  const code = String(formData.get('code') || '').trim()
  const session = await getSession()
  if (!session.pendingChallengeId || !session.pendingUserId || !session.pendingNewPassword) {
    redirect('/settings/password?error=Session%20expired')
  }

  const userId = await consumeAuthChallenge(session.pendingChallengeId, code, 'recovery')
  if (!userId || userId !== session.pendingUserId) {
    redirect('/settings/password/verify?error=Invalid%20or%20expired%20code')
  }

  await updatePassword(userId, session.pendingNewPassword)

  session.pendingChallengeId = undefined
  session.pendingUserId = undefined
  session.pendingUsername = undefined
  session.pendingNewPassword = undefined
  await session.save()

  redirect('/settings?ok=Password%20updated')
}

export default async function VerifyPasswordPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>
}) {
  const sp = (await searchParams) ?? {}
  const error = sp.error ?? null

  const session = await getSession()
  if (!session.userId) redirect('/login')
  if (!session.pendingChallengeId) redirect('/settings/password')

  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-xl font-semibold">Confirm password change</h1>
      <p className="text-sm text-[var(--muted)]">We sent a code to your Telegram. Enter it to finish.</p>

      {error ? <div className="rounded-lg bg-[var(--error-bg)] text-[var(--error-fg)] text-sm p-3">{error}</div> : null}

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

        <button className="w-full rounded-md bg-[var(--fg)] text-[var(--bg)] py-2">Update password</button>
      </form>
    </div>
  )
}
