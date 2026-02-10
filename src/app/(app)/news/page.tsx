import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { getActiveWorkspace } from '@/lib/workspace'
import { withUser } from '@/lib/db'
import { findNewsByWorkspace } from '@/lib/db/repositories/news.repository'
import { findSourcesByWorkspace } from '@/lib/db/repositories/news-source.repository'
import { findTabsByWorkspace } from '@/lib/db/repositories/news-tab.repository'
import { NewsShell } from './NewsShell'
import type { PoolClient } from 'pg'

async function getSourceTabMap(
  client: PoolClient,
  workspaceId: string
): Promise<Record<string, string[]>> {
  const result = await client.query(
    `select st.source_id as "sourceId", st.tab_id as "tabId"
     from content.news_source_tab st
     join content.news_source s on s.id = st.source_id
     where s.workspace_id = $1`,
    [workspaceId]
  )
  const map: Record<string, string[]> = {}
  for (const row of result.rows) {
    if (!map[row.sourceId]) map[row.sourceId] = []
    map[row.sourceId].push(row.tabId)
  }
  return map
}

export default async function NewsPage() {
  const session = await getSession()
  if (!session.userId) redirect('/login')

  const workspace = await getActiveWorkspace()
  if (!workspace) {
    return (
      <div className="p-6">
        <div className="text-center text-[var(--muted)]">Select a workspace to view news</div>
      </div>
    )
  }

  const [news, sources, tabs, sourceTabMap] = await withUser(session.userId, async (client) => {
    return Promise.all([
      findNewsByWorkspace(client, workspace.id, { limit: 30 }),
      findSourcesByWorkspace(client, workspace.id),
      findTabsByWorkspace(client, workspace.id),
      getSourceTabMap(client, workspace.id),
    ])
  })

  return (
    <NewsShell
      initialNews={news}
      initialSources={sources}
      initialTabs={tabs}
      initialSourceTabMap={sourceTabMap}
    />
  )
}
