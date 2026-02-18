import { signIn } from '@/app/auth/actions'

export const dynamic = 'force-dynamic'

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>
}) {
  const sp = (await searchParams) ?? {}
  const error = sp.error ?? null

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--card-fg)] p-6">
        <h1 className="text-xl font-semibold">ClawdOS</h1>
        <p className="text-sm text-[var(--muted)] mt-1">Local sign-in (tailnet only recommended).</p>

        {error ? (
          <div className="mt-4 rounded-lg bg-[var(--error-bg)] text-[var(--error-fg)] text-sm p-3">{error}</div>
        ) : null}

        <form className="mt-6 space-y-3" action={signIn}>
          <label className="block">
            <span className="text-sm text-[var(--muted-2)]">Username</span>
            <input
              name="username"
              required
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-[var(--input-fg)] placeholder:text-[var(--input-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              placeholder="username"
              autoComplete="username"
            />
          </label>

          <label className="block">
            <span className="text-sm text-[var(--muted-2)]">Password</span>
            <input
              name="password"
              type="password"
              required
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-[var(--input-fg)] placeholder:text-[var(--input-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              autoComplete="current-password"
            />
          </label>

          <button className="w-full rounded-md bg-[var(--fg)] text-[var(--bg)] py-2 hover:opacity-90 transition-opacity">Sign in</button>
        </form>

        <div className="mt-4 text-sm">
          <a className="underline text-[var(--muted-2)]" href="/recover">
            Forgot password?
          </a>
        </div>

        <p className="text-xs text-[var(--muted)] mt-6">
          Users are created via ops script (argon2id password hashes). No public signup.
        </p>
      </div>
    </main>
  )
}
