import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { getActiveWorkspace } from '@/lib/workspace'
import { withUser } from '@/lib/db'
import { findSourcesByWorkspace } from '@/lib/db/repositories/news-source.repository'
import { findTabsByWorkspace } from '@/lib/db/repositories/news-tab.repository'
import { fetchLiveFeeds } from '@/lib/rss/live'
import { NewsShell } from './NewsShell'
import type { PoolClient } from 'pg'
import type { NewsSource, NewsTab } from '@/types/news'

export const dynamic = 'force-dynamic'

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

/**
 * Async component that fetches RSS feeds and renders NewsShell.
 * Wrapped in Suspense so the page shell renders immediately
 * while RSS feeds load in the background (streaming).
 */
async function NewsFeedLoader({
  userId,
  sources,
  tabs,
  sourceTabMap,
}: {
  userId: string
  sources: NewsSource[]
  tabs: NewsTab[]
  sourceTabMap: Record<string, string[]>
}) {
  const news = await fetchLiveFeeds(sources)

  return (
    <NewsShell
      initialNews={news}
      initialSources={sources}
      initialTabs={tabs}
      initialSourceTabMap={sourceTabMap}
    />
  )
}

function NewsSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-8 w-24 rounded-lg bg-[var(--hover)]" />
        <div className="flex gap-3">
          <div className="h-9 w-24 rounded-lg bg-[var(--hover)]" />
          <div className="h-9 w-20 rounded-lg bg-[var(--hover)]" />
          <div className="h-9 w-20 rounded-lg bg-[var(--hover)]" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-48 rounded-xl bg-[var(--hover)]" />
        ))}
      </div>
    </div>
  )
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

  const [sources, tabs, sourceTabMap] = await withUser(session.userId, async (client) => {
    return Promise.all([
      findSourcesByWorkspace(client, workspace.id),
      findTabsByWorkspace(client, workspace.id),
      getSourceTabMap(client, workspace.id),
    ])
  })

  // If no sources yet, render NewsShell immediately (onboarding mode)
  if (sources.length === 0) {
    return (
      <NewsShell
        initialNews={[]}
        initialSources={sources}
        initialTabs={tabs}
        initialSourceTabMap={sourceTabMap}
      />
    )
  }

  // Stream: render page shell instantly, RSS feeds load in background
  return (
    <Suspense fallback={<NewsSkeleton />}>
      <NewsFeedLoader
        userId={session.userId}
        sources={sources}
        tabs={tabs}
        sourceTabMap={sourceTabMap}
      />
    </Suspense>
  )
}