import { withUser } from '@/lib/db'
import { getSession } from '@/lib/session'
import { getActiveWorkspace } from '@/lib/active-workspace'

export default async function TodayPage() {
  const session = await getSession()
  const workspace = await getActiveWorkspace()

  if (!session.userId) return null

  if (!workspace) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Today</h1>
        <p className="text-sm text-slate-300 mt-2">No workspaces found for this user.</p>
      </div>
    )
  }

  const digests = await withUser(session.userId, async (client) => {
    const res = await client.query(
      `select
         id,
         date,
         title,
         left(body, 280) as summary,
         created_at
       from content.digest
       where workspace_id = $1
       order by date desc
       limit 30`,
      [workspace.id]
    )
    return res.rows as Array<{ id: string; date: string; title: string; summary: string | null }>
  })

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Today</h1>
        <div className="text-sm text-[var(--muted)]">Workspace: {workspace.name}</div>
      </div>

      <ul className="mt-6 space-y-3">
        {digests.map((d) => (
          <li key={d.id} className="rounded-lg border p-4">
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
