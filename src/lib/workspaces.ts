import { cookies } from 'next/headers'
import { withUser } from '@/lib/db'
import { getSession } from '@/lib/session'

export const ACTIVE_WORKSPACE_COOKIE = 'lifeos.active_workspace'

export type Workspace = {
  id: string
  name: string
  slug: string
  type: 'personal' | 'shared'
}

export async function getWorkspacesForUser(): Promise<Workspace[]> {
  const session = await getSession()
  if (!session.userId) return []

  return withUser(session.userId, async (client) => {
    const res = await client.query(
      `select w.id, w.name, w.slug, w.kind as type
       from core.workspace w
       join core.membership m on m.workspace_id = w.id
       where m.user_id = core.current_user_id()
       order by (w.kind = 'shared') asc, w.name asc`
    )
    return res.rows as Workspace[]
  })
}

export async function getActiveWorkspaceId(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value ?? null
}
