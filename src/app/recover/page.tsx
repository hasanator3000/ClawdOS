import { redirect } from 'next/navigation'
import { getPool } from '@/lib/db'
import { createAuthChallenge, enqueueTelegram } from '@/lib/auth'

export const dynamic = 'force-dynamic'

async function requestRecovery(formData: FormData) {
  'use server'

  const username = String(formData.get('username') || '').trim()
  if (!username) redirect('/recover?error=Enter%20username')

  const pool = getPool()
  const res = await pool.query('select id, telegram_user_id from core."user" where username=$1', [username])
  const row = res.rows[0] as { id: string; telegram_user_id: string | null } | undefined

  // Always redirect (avoid username enumeration). If Telegram isn't linked, recovery won't work.
  if (row?.telegram_user_id) {
    const ch = await createAuthChallenge(row.id, 'recovery')
    await enqueueTelegram(row.telegram_user_id, `LifeOS recovery code: ${ch.code} (valid 10 min)`)
    redirect(`/recover/verify?cid=${encodeURIComponent(ch.id)}`)
  }

  redirect('/recover?sent=1')
}

export default async function RecoverPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; sent?: string }>
}) {
  const sp = (await searchParams) ?? {}
  const error = sp.error ?? null
  const sent = sp.sent === '1'

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--card-fg)] p-6">
        <h1 className="text-xl font-semibold">Password recovery</h1>
        <p className="text-sm text-[var(--muted)] mt-1">If Telegram is linked, we will send a recovery code.</p>

        {error ? (
          <div className="mt-4 rounded-lg bg-red-50 text-red-700 text-sm p-3">{error}</div>
        ) : null}
        {sent ? (
          <div className="mt-4 rounded-lg bg-emerald-50 text-emerald-800 text-sm p-3">
            If Telegram is linked, a code was sent.
          </div>
        ) : null}

        <form className="mt-6 space-y-3" action={requestRecovery}>
          <label className="block">
            <span className="text-sm text-[var(--muted-2)]">Username</span>
            <input
              name="username"
              required
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-[var(--input-fg)] placeholder:text-[var(--input-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              placeholder="ag1"
              autoComplete="username"
            />
          </label>

          <button className="w-full rounded-md bg-[var(--fg)] text-[var(--bg)] py-2">Send code</button>
        </form>
      </div>
    </main>
  )
}
