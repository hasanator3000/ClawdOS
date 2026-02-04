import { withUser } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { getActiveWorkspace } from '@/lib/workspace'
import { findDigestsByWorkspace } from '@/lib/db/repositories/digest.repository'

export default async function TodayPage() {
  const session = await getSession()
  const workspace = await getActiveWorkspace()

  if (!session.userId) return null

  if (!workspace) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Today</h1>
        <p className="text-sm text-[var(--muted)] mt-2">No workspaces found for this user.</p>
      </div>
    )
  }

  const digests = await withUser(session.userId, (client) =>
    findDigestsByWorkspace(client, workspace.id)
  )

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Today</h1>
        <div className="text-sm text-[var(--muted)]">Workspace: {workspace.name}</div>
      </div>

      <ul className="mt-6 space-y-3">
        {digests.map((d) => (
          <li key={d.id} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="flex items-baseline justify-between gap-4">
              <div className="font-medium">{d.title ?? `Digest ${d.date}`}</div>
              <div className="text-xs text-[var(--muted)]">{d.date}</div>
            </div>
            {d.summary ? <p className="mt-2 text-sm text-[var(--muted-2)]">{d.summary}</p> : null}
          </li>
        ))}

        {digests.length === 0 ? <li className="text-sm text-[var(--muted)]">No digests yet.</li> : null}
      </ul>
    </div>
  )
}
