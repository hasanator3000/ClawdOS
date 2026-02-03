import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/session'
import { getPool, withUser } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const session = await getSession()
  if (!session.userId) redirect('/login')

  const pool = getPool()
  const res = await withUser(session.userId, async (client) => {
    return client.query('select telegram_user_id, password_updated_at, created_at from core."user" where id=$1', [
      session.userId,
    ])
  })

  const row = res.rows[0] as {
    telegram_user_id: string | null
    password_updated_at: string | null
    created_at: string
  }

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Settings</h1>
        <div className="text-sm text-[var(--muted)]">User: {session.username}</div>
      </div>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="font-medium">Security</h2>
        <div className="mt-2 text-sm text-[var(--muted)]">
          Password updated: {row.password_updated_at ? new Date(row.password_updated_at).toLocaleString() : 'never'}
        </div>
        <div className="mt-3">
          <Link className="underline text-[var(--muted-2)]" href="/settings/password">
            Change password
          </Link>
        </div>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="font-medium">Telegram 2FA / recovery</h2>
        <div className="mt-2 text-sm text-[var(--muted)]">
          {row.telegram_user_id ? (
            <>Linked Telegram user id: {row.telegram_user_id}</>
          ) : (
            <>Not linked. If you link Telegram, logins and recovery will send codes there.</>
          )}
        </div>
        <div className="mt-3">
          <Link className="underline text-[var(--muted-2)]" href="/settings/telegram">
            {row.telegram_user_id ? 'Relink Telegram' : 'Link Telegram'}
          </Link>
        </div>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="font-medium">Account</h2>
        <div className="mt-2 text-sm text-[var(--muted)]">Created: {new Date(row.created_at).toLocaleString()}</div>
        <div className="mt-3 text-sm text-[var(--muted)]">Username changes are not implemented yet.</div>
      </section>
    </div>
  )
}
