import { redirect } from 'next/navigation'
import { consumeAuthChallenge, updatePassword } from '@/lib/auth'

export const dynamic = 'force-dynamic'

async function setPassword(formData: FormData) {
  'use server'

  const cid = String(formData.get('cid') || '')
  const code = String(formData.get('code') || '').trim()
  const password = String(formData.get('password') || '')
  const confirm = String(formData.get('confirm') || '')

  if (!cid) redirect('/recover?error=Missing%20challenge')
  if (password.length < 10) redirect(`/recover/verify?cid=${encodeURIComponent(cid)}&error=Password%20too%20short`)
  if (password !== confirm) redirect(`/recover/verify?cid=${encodeURIComponent(cid)}&error=Passwords%20do%20not%20match`)

  const userId = await consumeAuthChallenge(cid, code, 'recovery')
  if (!userId) redirect(`/recover/verify?cid=${encodeURIComponent(cid)}&error=Invalid%20or%20expired%20code`)

  await updatePassword(userId, password)
  redirect('/login?error=Password%20updated')
}

export default async function RecoverVerifyPage({
  searchParams,
}: {
  searchParams?: Promise<{ cid?: string; error?: string }>
}) {
  const sp = (await searchParams) ?? {}
  const cid = sp.cid ?? ''
  const error = sp.error ?? null

  if (!cid) redirect('/recover')

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--card-fg)] p-6">
        <h1 className="text-xl font-semibold">Set new password</h1>
        <p className="text-sm text-[var(--muted)] mt-1">Enter the code from Telegram and choose a new password.</p>

        {error ? (
          <div className="mt-4 rounded-lg bg-[var(--error-bg)] text-[var(--error-fg)] text-sm p-3">{error}</div>
        ) : null}

        <form className="mt-6 space-y-3" action={setPassword}>
          <input type="hidden" name="cid" value={cid} />

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

          <label className="block">
            <span className="text-sm text-[var(--muted-2)]">New password</span>
            <input
              name="password"
              type="password"
              required
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-[var(--input-fg)] placeholder:text-[var(--input-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </label>

          <label className="block">
            <span className="text-sm text-[var(--muted-2)]">Confirm password</span>
            <input
              name="confirm"
              type="password"
              required
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-[var(--input-fg)] placeholder:text-[var(--input-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </label>

          <button className="w-full rounded-md bg-[var(--fg)] text-[var(--bg)] py-2 hover:opacity-90 transition-opacity">Update password</button>
        </form>
      </div>
    </main>
  )
}
