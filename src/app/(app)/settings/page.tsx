import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { withUser } from '@/lib/db'
import { getUserProfile } from '@/lib/db/repositories/user.repository'
import { signOut } from '@/app/auth/actions'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const session = await getSession()
  if (!session.userId) redirect('/login')

  const profile = await withUser(session.userId, (client) =>
    getUserProfile(client, session.userId!)
  )

  if (!profile) redirect('/login')

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between pr-12">
        <h1 className="text-xl font-semibold">Settings</h1>
        <div className="text-sm text-[var(--muted)]">User: {session.username}</div>
      </div>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="font-medium">Security</h2>
        <div className="mt-2 text-sm text-[var(--muted)]">
          Password updated: {profile.passwordUpdatedAt ? new Date(profile.passwordUpdatedAt).toLocaleString() : 'never'}
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
          {profile.telegramUserId ? (
            <>Linked Telegram user id: {profile.telegramUserId}</>
          ) : (
            <>Not linked. If you link Telegram, logins and recovery will send codes there.</>
          )}
        </div>
        <div className="mt-3">
          <Link className="underline text-[var(--muted-2)]" href="/settings/telegram">
            {profile.telegramUserId ? 'Relink Telegram' : 'Link Telegram'}
          </Link>
        </div>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="font-medium">Account</h2>
        <div className="mt-2 text-sm text-[var(--muted)]">Created: {new Date(profile.createdAt).toLocaleString()}</div>
        <div className="mt-3 text-sm text-[var(--muted)]">Username changes are not implemented yet.</div>

        <div className="mt-4">
          <form action={signOut}>
            <button className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--hover)]">
              Sign out
            </button>
          </form>
        </div>
      </section>
    </div>
  )
}
