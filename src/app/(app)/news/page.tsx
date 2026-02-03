import Link from 'next/link'
import { withUser } from '@/lib/db'
import { getSession } from '@/lib/session'
import { getActiveWorkspace } from '@/lib/active-workspace'

export default async function NewsPage() {
  const session = await getSession()
  const workspace = await getActiveWorkspace()

  if (!session.userId) return null

  if (!workspace) {
    return (
      <div>
        <h1 className="text-xl font-semibold">News</h1>
        <p className="text-sm text-slate-300 mt-2">No workspaces found for this user.</p>
      </div>
    )
  }

  const news = await withUser(session.userId, async (client) => {
    const res = await client.query(
      `select id, title, url, topic, summary, published_at, created_at
       from content.news_item
       where workspace_id = $1
       order by published_at desc nulls last, created_at desc
       limit 50`,
      [workspace.id]
    )
    return res.rows as Array<{
      id: string
      title: string
      url: string
      topic: string
      summary: string
      published_at: string | null
    }>
  })

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">News</h1>
        <div className="text-sm text-slate-400">Workspace: {workspace.name}</div>
      </div>

      <ul className="mt-6 space-y-3">
        {news.map((n) => (
          <li key={n.id} className="rounded-lg border p-4">
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
              <div className="text-xs text-slate-400">
                {n.published_at ? new Date(n.published_at).toLocaleString() : ''}
              </div>
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {n.topic}
              {n.summary ? <span className="ml-2 text-slate-300">— {n.summary}</span> : null}
            </div>
          </li>
        ))}

        {news.length === 0 ? <li className="text-sm text-slate-300">No news items yet.</li> : null}
      </ul>
    </div>
  )
}
