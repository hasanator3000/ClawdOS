import Link from 'next/link'
import { withUser } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { getActiveWorkspace } from '@/lib/workspace'
import { findNewsByWorkspace } from '@/lib/db/repositories/news.repository'

export default async function NewsPage() {
  const session = await getSession()
  const workspace = await getActiveWorkspace()

  if (!session.userId) return null

  if (!workspace) {
    return (
      <div>
        <h1 className="text-xl font-semibold">News</h1>
        <p className="text-sm text-[var(--muted)] mt-2">No workspaces found for this user.</p>
      </div>
    )
  }

  const news = await withUser(session.userId, (client) =>
    findNewsByWorkspace(client, workspace.id)
  )

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">News</h1>
        <div className="text-sm text-[var(--muted)]">Workspace: {workspace.name}</div>
      </div>

      <ul className="mt-6 space-y-3">
        {news.map((n) => (
          <li key={n.id} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="flex items-baseline justify-between gap-4">
              <div className="font-medium">
                {n.url ? (
                  <Link className="underline" href={n.url} target="_blank">
                    {n.title}
                  </Link>
                ) : (
                  n.title
                )}
              </div>
              <div className="text-xs text-[var(--muted)]">
                {n.publishedAt ? new Date(n.publishedAt).toLocaleString() : ''}
              </div>
            </div>
            <div className="mt-1 text-xs text-[var(--muted)]">
              {n.topic}
              {n.summary ? <span className="ml-2 text-[var(--muted-2)]">— {n.summary}</span> : null}
            </div>
          </li>
        ))}

        {news.length === 0 ? <li className="text-sm text-[var(--muted)]">No news items yet.</li> : null}
      </ul>
    </div>
  )
}
