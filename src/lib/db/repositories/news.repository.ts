import type { PoolClient } from 'pg'
import type { NewsItem } from '@/types/news'

export async function findNewsByWorkspace(
  client: PoolClient,
  workspaceId: string,
  limit = 50
): Promise<NewsItem[]> {
  const res = await client.query(
    `select
       id,
       title,
       url,
       topic,
       summary,
       published_at as "publishedAt"
     from content.news_item
     where workspace_id = $1
     order by published_at desc nulls last, created_at desc
     limit $2`,
    [workspaceId, limit]
  )
  return res.rows as NewsItem[]
}
