import type { PoolClient } from 'pg'
import type { Workspace } from '@/types/workspace'

export async function findWorkspacesByUserId(client: PoolClient): Promise<Workspace[]> {
  const res = await client.query(
    `select w.id, w.name, w.slug, w.kind as type
     from core.workspace w
     join core.membership m on m.workspace_id = w.id
     where m.user_id = core.current_user_id()
     order by (w.kind = 'shared') asc, w.name asc`
  )
  return res.rows as Workspace[]
}
