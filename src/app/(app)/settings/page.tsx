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

      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="text-base font-semibold">Security</h2>
        <p className="mt-2 text-[15px] text-[var(--muted)]">
          Password updated: {profile.passwordUpdatedAt ? new Date(profile.passwordUpdatedAt).toLocaleString() : 'never'}
        </p>
        <div className="mt-4">
          <Link className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--fg)] transition-colors hover:bg-[var(--hover)] hover:border-[var(--neon-dim)]" href="/settings/password">
            Change password
          </Link>
        </div>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="text-base font-semibold">Telegram 2FA / recovery</h2>
        <p className="mt-2 text-[15px] text-[var(--muted)]">
          {profile.telegramUserId ? (
            <>Linked Telegram user id: {profile.telegramUserId}</>
          ) : (
            <>Not linked. If you link Telegram, logins and recovery will send codes there.</>
          )}
        </p>
        <div className="mt-4">
          <Link className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--fg)] transition-colors hover:bg-[var(--hover)] hover:border-[var(--neon-dim)]" href="/settings/telegram">
            {profile.telegramUserId ? 'Relink Telegram' : 'Link Telegram'}
          </Link>
        </div>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="text-base font-semibold">Dashboard</h2>
        <p className="mt-2 text-[15px] text-[var(--muted)]">Customize currencies, weather city, and timezone.</p>
        <div className="mt-4">
          <Link className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--fg)] transition-colors hover:bg-[var(--hover)] hover:border-[var(--neon-dim)]" href="/settings/dashboard">
            Dashboard preferences
          </Link>
        </div>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="text-base font-semibold">Clawdbot</h2>
        <p className="mt-2 text-[15px] text-[var(--muted)]">Agent skills, commands, and workspace files.</p>
        <div className="mt-4 flex gap-3">
          <Link className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--fg)] transition-colors hover:bg-[var(--hover)] hover:border-[var(--neon-dim)]" href="/settings/skills">Skills & Marketplace</Link>
          <Link className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--fg)] transition-colors hover:bg-[var(--hover)] hover:border-[var(--neon-dim)]" href="/settings/files">Agent Files</Link>
        </div>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="text-base font-semibold">Account</h2>
        <p className="mt-2 text-[15px] text-[var(--muted)]">Created: {new Date(profile.createdAt).toLocaleString()}</p>
        <p className="mt-2 text-[15px] text-[var(--muted)]">Username changes are not implemented yet.</p>

        <div className="mt-5">
          <form action={signOut}>
            <button className="w-full rounded-lg border border-[var(--border)] px-4 py-3 text-[15px] font-medium transition-colors hover:bg-[var(--hover)] hover:border-[var(--neon-dim)]">
              Sign out
            </button>
          </form>
        </div>
      </section>
    </div>
  )
}
