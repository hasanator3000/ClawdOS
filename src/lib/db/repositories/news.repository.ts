import type { PoolClient } from 'pg'
import type { NewsItem } from '@/types/news'

export interface FindNewsOptions {
  limit?: number
  cursor?: string // ISO timestamp of last item for pagination
  cursorId?: string // ID of last item for stable pagination
  tabId?: string
  search?: string
  sourceId?: string
}

export async function findNewsByWorkspace(
  client: PoolClient,
  workspaceId: string,
  optionsOrLimit?: FindNewsOptions | number
): Promise<NewsItem[]> {
  // Backwards-compatible: accept plain number as limit
  const opts: FindNewsOptions =
    typeof optionsOrLimit === 'number'
      ? { limit: optionsOrLimit }
      : optionsOrLimit ?? {}

  const { limit = 30, cursor, cursorId, tabId, search, sourceId } = opts
  const values: unknown[] = [workspaceId]
  const conditions: string[] = ['ni.workspace_id = $1']
  let paramIdx = 2

  // Cursor-based pagination
  if (cursor && cursorId) {
    conditions.push(
      `(ni.published_at, ni.id) < ($${paramIdx}::timestamptz, $${paramIdx + 1}::uuid)`
    )
    values.push(cursor, cursorId)
    paramIdx += 2
  }

  // Filter by tab (via source → source_tab junction)
  if (tabId) {
    conditions.push(
      `exists (
        select 1 from content.news_source_tab nst
        where nst.source_id = ni.source_id and nst.tab_id = $${paramIdx}
      )`
    )
    values.push(tabId)
    paramIdx++
  }

  // Filter by source
  if (sourceId) {
    conditions.push(`ni.source_id = $${paramIdx}`)
    values.push(sourceId)
    paramIdx++
  }

  // Search by ILIKE
  if (search) {
    const pattern = `%${search}%`
    conditions.push(
      `(ni.title ilike $${paramIdx} or ni.summary ilike $${paramIdx})`
    )
    values.push(pattern)
    paramIdx++
  }

  values.push(limit)

  const result = await client.query(
    `select
       ni.id,
       ni.title,
       ni.url,
       ni.topic,
       ni.summary,
       ni.published_at as "publishedAt",
       ni.source_id as "sourceId",
       ni.guid,
       ns.title as "sourceName"
     from content.news_item ni
     left join content.news_source ns on ns.id = ni.source_id
     where ${conditions.join(' and ')}
     order by ni.published_at desc nulls last, ni.created_at desc
     limit $${paramIdx}`,
    values
  )

  return result.rows as NewsItem[]
}

export async function upsertNewsItem(
  client: PoolClient,
  params: {
    workspaceId: string
    sourceId: string
    title: string
    url?: string | null
    summary?: string | null
    publishedAt?: string | null
    guid: string
    topic?: string | null
  }
): Promise<NewsItem | null> {
  const { workspaceId, sourceId, title, url, summary, publishedAt, guid, topic } = params

  const result = await client.query(
    `insert into content.news_item
       (workspace_id, source_id, title, url, summary, published_at, guid, topic, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, core.current_user_id())
     on conflict (source_id, guid) where guid is not null do nothing
     returning
       id, title, url, topic, summary,
       published_at as "publishedAt",
       source_id as "sourceId",
       guid`,
    [workspaceId, sourceId, title || 'Untitled', url || '', summary || '', publishedAt || null, guid, topic || 'other']
  )

  return (result.rows[0] as NewsItem) || null
}

export async function cleanupOldItems(
  client: PoolClient,
  sourceId: string,
  maxItems: number = 200,
  maxAgeDays: number = 30
): Promise<number> {
  // Delete items older than maxAgeDays
  const ageResult = await client.query(
    `delete from content.news_item
     where source_id = $1
       and created_at < now() - interval '1 day' * $2`,
    [sourceId, maxAgeDays]
  )

  // Delete excess items beyond maxItems (keep newest)
  const excessResult = await client.query(
    `delete from content.news_item
     where id in (
       select id from content.news_item
       where source_id = $1
       order by published_at desc nulls last, created_at desc
       offset $2
     )`,
    [sourceId, maxItems]
  )

  return (ageResult.rowCount ?? 0) + (excessResult.rowCount ?? 0)
}
