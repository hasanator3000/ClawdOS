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
      <div className="w-full max-w-sm rounded-xl border p-6 bg-white">
        <h1 className="text-xl font-semibold">LifeOS</h1>
        <p className="text-sm text-gray-600 mt-1">Local sign-in (tailnet only recommended).</p>

        {error ? (
          <div className="mt-4 rounded-lg bg-red-50 text-red-700 text-sm p-3">{error}</div>
        ) : null}

        <form className="mt-6 space-y-3" action={signIn}>
          <label className="block">
            <span className="text-sm text-gray-700">Username</span>
            <input
              name="username"
              required
              className="mt-1 w-full rounded-md border px-3 py-2"
              placeholder="ag"
              autoComplete="username"
            />
          </label>

          <label className="block">
            <span className="text-sm text-gray-700">Password</span>
            <input
              name="password"
              type="password"
              required
              className="mt-1 w-full rounded-md border px-3 py-2"
              autoComplete="current-password"
            />
          </label>

          <button className="w-full rounded-md bg-black text-white py-2">Sign in</button>
        </form>

        <p className="text-xs text-gray-500 mt-6">
          Users are created via ops script (argon2id password hashes). No public signup.
        </p>
      </div>
    </main>
  )
}
