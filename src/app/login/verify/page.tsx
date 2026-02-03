import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'

async function verify(formData: FormData) {
  'use server'

  const code = String(formData.get('code') || '').trim()
  if (code.length < 4) redirect('/login/verify?error=Invalid%20code')

  const session = await getSession()
  if (!session.pendingChallengeId || !session.pendingUserId || !session.pendingUsername) {
    redirect('/login?error=Session%20expired')
  }

  const { consumeAuthChallenge } = await import('@/lib/auth')
  const userId = await consumeAuthChallenge(session.pendingChallengeId, code, 'login')
  if (!userId || userId !== session.pendingUserId) {
    redirect('/login/verify?error=Invalid%20or%20expired%20code')
  }

  session.userId = session.pendingUserId
  session.username = session.pendingUsername
  session.pendingChallengeId = undefined
  session.pendingUserId = undefined
  session.pendingUsername = undefined
  await session.save()

  redirect('/today')
}

export default async function VerifyLoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>
}) {
  const sp = (await searchParams) ?? {}
  const error = sp.error ?? null

  const session = await getSession()
  if (session.userId) redirect('/today')
  if (!session.pendingChallengeId) redirect('/login')

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--card-fg)] p-6">
        <h1 className="text-xl font-semibold">Verify</h1>
        <p className="text-sm text-[var(--muted)] mt-1">We sent a login code to your Telegram.</p>

        {error ? (
          <div className="mt-4 rounded-lg bg-red-50 text-red-700 text-sm p-3">{error}</div>
        ) : null}

        <form className="mt-6 space-y-3" action={verify}>
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

          <button className="w-full rounded-md bg-[var(--fg)] text-[var(--bg)] py-2">Continue</button>
        </form>
      </div>
    </main>
  )
}
