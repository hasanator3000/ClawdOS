import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

const TOKEN_COOKIE = 'lifeos.access_token'

export const dynamic = 'force-dynamic'

async function setAccessToken(formData: FormData) {
  'use server'

  const required = process.env.ACCESS_TOKEN
  if (!required) {
    // If the gate isn't configured, just proceed.
    redirect('/today')
  }

  const token = String(formData.get('token') || '').trim()
  const next = String(formData.get('next') || '/today')

  if (token !== required) {
    redirect(`/access?error=Invalid%20token&next=${encodeURIComponent(next)}`)
  }

  const store = await cookies()
  store.set(TOKEN_COOKIE, required, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false, // set true when behind HTTPS
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })

  redirect(next)
}

export default async function AccessPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string; error?: string }>
}) {
  const sp = (await searchParams) ?? {}
  const next = sp.next ?? '/today'
  const error = sp.error ?? null

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--card-fg)] p-6">
        <h1 className="text-xl font-semibold">LifeOS</h1>
        <p className="text-sm text-[var(--muted)] mt-1">This instance is gated. Enter the access token.</p>

        {error ? (
          <div className="mt-4 rounded-lg bg-red-50 text-red-700 text-sm p-3">{error}</div>
        ) : null}

        <form className="mt-6 space-y-3" action={setAccessToken}>
          <input type="hidden" name="next" value={next} />

          <label className="block">
            <span className="text-sm text-[var(--muted-2)]">Access token</span>
            <input
              name="token"
              required
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-[var(--input-fg)] placeholder:text-[var(--input-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              placeholder="Paste token"
              autoComplete="off"
            />
          </label>

          <button className="w-full rounded-md bg-[var(--fg)] text-[var(--bg)] py-2">Continue</button>
        </form>

        <p className="text-xs text-[var(--muted)] mt-6">
          Tip: you can also open <code className="px-1 py-0.5 rounded border border-[var(--border)]">/?token=…</code> once to
          set the cookie.
        </p>
      </div>
    </main>
  )
}
