import Link from 'next/link'
import { getSession } from '@/lib/session'
import { getActiveWorkspaceId, getWorkspacesForUser } from '@/lib/workspaces'
import { setActiveWorkspace } from '@/app/(app)/actions'
import { signOut } from '@/app/auth/actions'

export default async function Sidebar() {
  const session = await getSession()
  const workspaces = await getWorkspacesForUser()
  const activeWorkspaceId = await getActiveWorkspaceId()
  const active = workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0]

  return (
    <aside className="w-72 border-r border-[var(--border)] bg-[var(--card)] text-[var(--card-fg)] p-4 flex flex-col gap-4">
      <div>
        <div className="font-semibold">LifeOS</div>
        <div className="text-xs text-[var(--muted)] truncate">{session.username}</div>
      </div>

      <div className="space-y-2">
        <div className="text-xs uppercase tracking-wide text-[var(--muted)]">Workspace</div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)]">
          {workspaces.map((ws) => {
            const isActive = ws.id === active?.id
            return (
              <form key={ws.id} action={setActiveWorkspace.bind(null, ws.id)}>
                <button
                  type="submit"
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--hover)] ${isActive ? 'font-medium bg-[var(--hover)]' : ''}`}
                >
                  {ws.name}
                  <span className="ml-2 text-xs text-[var(--muted)]">({ws.type})</span>
                </button>
              </form>
            )
          })}
          {workspaces.length === 0 ? <div className="px-3 py-2 text-sm text-[var(--muted)]">No workspaces</div> : null}
        </div>
      </div>

      <nav className="space-y-1">
        <Link className="block rounded-md px-3 py-2 hover:bg-[var(--hover)]" href="/today">
          Today
        </Link>
        <Link className="block rounded-md px-3 py-2 hover:bg-[var(--hover)]" href="/news">
          News
        </Link>
        <Link className="block rounded-md px-3 py-2 hover:bg-[var(--hover)]" href="/settings">
          Settings
        </Link>
      </nav>

      <div className="mt-auto">
        <form action={signOut}>
          <button className="w-full rounded-md border px-3 py-2 text-sm">Sign out</button>
        </form>
      </div>
    </aside>
  )
}
