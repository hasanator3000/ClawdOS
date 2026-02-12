import type { PoolClient } from 'pg'
import type { NewsTab } from '@/types/news'

const SELECT_COLS = `
  id,
  workspace_id as "workspaceId",
  name,
  sort_order as "sortOrder"
`

export async function createNewsTab(
  client: PoolClient,
  params: { workspaceId: string; name: string }
): Promise<NewsTab> {
  const { workspaceId, name } = params

  const result = await client.query(
    `insert into content.news_tab (workspace_id, name, sort_order, created_by)
     values ($1, $2, coalesce(
       (select max(sort_order) + 1 from content.news_tab where workspace_id = $1),
       0
     ), core.current_user_id())
     returning ${SELECT_COLS}`,
    [workspaceId, name]
  )

  return result.rows[0] as NewsTab
}

export async function findTabsByWorkspace(
  client: PoolClient,
  workspaceId: string
): Promise<NewsTab[]> {
  const result = await client.query(
    `select ${SELECT_COLS}
     from content.news_tab
     where workspace_id = $1
     order by sort_order asc, created_at asc`,
    [workspaceId]
  )

  return result.rows as NewsTab[]
}

export async function findTabById(
  client: PoolClient,
  tabId: string
): Promise<NewsTab | null> {
  const result = await client.query(
    `select ${SELECT_COLS} from content.news_tab where id = $1`,
    [tabId]
  )
  return (result.rows[0] as NewsTab) || null
}

export async function findTabByName(
  client: PoolClient,
  workspaceId: string,
  name: string
): Promise<NewsTab | null> {
  const result = await client.query(
    `select ${SELECT_COLS}
     from content.news_tab
     where workspace_id = $1 and lower(name) = lower($2)`,
    [workspaceId, name]
  )
  return (result.rows[0] as NewsTab) || null
}

export async function deleteNewsTab(
  client: PoolClient,
  tabId: string
): Promise<boolean> {
  const result = await client.query(
    'delete from content.news_tab where id = $1',
    [tabId]
  )
  return (result.rowCount ?? 0) > 0
}

export async function reorderTabs(
  client: PoolClient,
  tabIds: string[]
): Promise<void> {
  if (tabIds.length === 0) return

  // Single bulk UPDATE instead of N individual queries
  await client.query(
    `update content.news_tab as t
     set sort_order = v.ord
     from (select unnest($1::uuid[]) as id, generate_series(0, $2) as ord) as v
     where t.id = v.id`,
    [tabIds, tabIds.length - 1]
  )
}

export async function assignSourceToTab(
  client: PoolClient,
  sourceId: string,
  tabId: string
): Promise<void> {
  await client.query(
    `insert into content.news_source_tab (source_id, tab_id)
     values ($1, $2)
     on conflict do nothing`,
    [sourceId, tabId]
  )
}

export async function removeSourceFromTab(
  client: PoolClient,
  sourceId: string,
  tabId: string
): Promise<boolean> {
  const result = await client.query(
    'delete from content.news_source_tab where source_id = $1 and tab_id = $2',
    [sourceId, tabId]
  )
  return (result.rowCount ?? 0) > 0
}

export async function findSourceIdsByTab(
  client: PoolClient,
  tabId: string
): Promise<string[]> {
  const result = await client.query(
    'select source_id as "sourceId" from content.news_source_tab where tab_id = $1',
    [tabId]
  )
  return result.rows.map((r: { sourceId: string }) => r.sourceId)
}

export async function findTabsForSource(
  client: PoolClient,
  sourceId: string
): Promise<NewsTab[]> {
  const result = await client.query(
    `select t.id, t.workspace_id as "workspaceId", t.name, t.sort_order as "sortOrder"
     from content.news_tab t
     join content.news_source_tab st on st.tab_id = t.id
     where st.source_id = $1
     order by t.sort_order`,
    [sourceId]
  )
  return result.rows as NewsTab[]
}
