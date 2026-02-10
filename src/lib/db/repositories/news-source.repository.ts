import type { PoolClient } from 'pg'
import type { NewsSource } from '@/types/news'

const SELECT_COLS = `
  id,
  workspace_id as "workspaceId",
  url,
  title,
  feed_type as "feedType",
  status,
  error_message as "errorMessage",
  error_count as "errorCount",
  last_fetched_at as "lastFetchedAt",
  created_at as "createdAt"
`

export async function createNewsSource(
  client: PoolClient,
  params: {
    workspaceId: string
    url: string
    title?: string
    feedType?: string
  }
): Promise<NewsSource> {
  const { workspaceId, url, title, feedType = 'rss' } = params

  const result = await client.query(
    `insert into content.news_source (workspace_id, url, title, feed_type, created_by)
     values ($1, $2, $3, $4, core.current_user_id())
     returning ${SELECT_COLS}`,
    [workspaceId, url, title || null, feedType]
  )

  return result.rows[0] as NewsSource
}

export async function findSourcesByWorkspace(
  client: PoolClient,
  workspaceId: string
): Promise<NewsSource[]> {
  const result = await client.query(
    `select ${SELECT_COLS}
     from content.news_source
     where workspace_id = $1
     order by created_at`,
    [workspaceId]
  )

  return result.rows as NewsSource[]
}

export async function findSourceById(
  client: PoolClient,
  sourceId: string
): Promise<NewsSource | null> {
  const result = await client.query(
    `select ${SELECT_COLS}
     from content.news_source
     where id = $1`,
    [sourceId]
  )

  return (result.rows[0] as NewsSource) || null
}

export async function updateSourceStatus(
  client: PoolClient,
  sourceId: string,
  status: string,
  errorMessage?: string | null
): Promise<NewsSource | null> {
  const result = await client.query(
    `update content.news_source
     set status = $1,
         error_message = $2,
         error_count = case when $1 = 'active' then 0 else error_count end
     where id = $3
     returning ${SELECT_COLS}`,
    [status, errorMessage ?? null, sourceId]
  )

  return (result.rows[0] as NewsSource) || null
}

export async function incrementSourceError(
  client: PoolClient,
  sourceId: string,
  errorMessage: string
): Promise<NewsSource | null> {
  const result = await client.query(
    `update content.news_source
     set error_count = error_count + 1,
         error_message = $1,
         status = case when error_count + 1 >= 3 then 'error' else status end
     where id = $2
     returning ${SELECT_COLS}`,
    [errorMessage, sourceId]
  )

  return (result.rows[0] as NewsSource) || null
}

export async function markSourceFetched(
  client: PoolClient,
  sourceId: string
): Promise<void> {
  await client.query(
    `update content.news_source
     set last_fetched_at = now(),
         error_count = 0,
         error_message = null,
         status = 'active'
     where id = $1`,
    [sourceId]
  )
}

export async function deleteNewsSource(
  client: PoolClient,
  sourceId: string
): Promise<boolean> {
  const result = await client.query(
    'delete from content.news_source where id = $1',
    [sourceId]
  )
  return (result.rowCount ?? 0) > 0
}

export async function findStaleSources(
  client: PoolClient,
  workspaceId: string,
  staleMinutes: number = 15
): Promise<NewsSource[]> {
  const result = await client.query(
    `select ${SELECT_COLS}
     from content.news_source
     where workspace_id = $1
       and status = 'active'
       and (last_fetched_at is null or last_fetched_at < now() - interval '1 minute' * $2)
     order by last_fetched_at nulls first`,
    [workspaceId, staleMinutes]
  )

  return result.rows as NewsSource[]
}

export async function countSourcesByWorkspace(
  client: PoolClient,
  workspaceId: string
): Promise<number> {
  const result = await client.query(
    'select count(*)::int as count from content.news_source where workspace_id = $1',
    [workspaceId]
  )
  return result.rows[0].count
}
