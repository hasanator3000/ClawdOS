import type { PoolClient } from 'pg'
import type { Digest } from '@/types/digest'

export async function findDigestsByWorkspace(
  client: PoolClient,
  workspaceId: string,
  limit = 30
): Promise<Digest[]> {
  const res = await client.query(
    `select
       id,
       date,
       title,
       left(body, 280) as summary,
       created_at as "createdAt"
     from content.digest
     where workspace_id = $1
     order by date desc
     limit $2`,
    [workspaceId, limit]
  )
  return res.rows as Digest[]
}
