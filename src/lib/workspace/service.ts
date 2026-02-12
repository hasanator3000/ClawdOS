import { cache } from 'react'
import { cookies } from 'next/headers'
import { withUser } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { findWorkspacesByUserId } from '@/lib/db/repositories/workspace.repository'
import { ACTIVE_WORKSPACE_COOKIE } from '@/lib/constants'
import type { Workspace } from '@/types/workspace'

/**
 * Fetches workspaces for the current user.
 * Wrapped in React.cache() so multiple calls within the same RSC request
 * are deduplicated (layout + page both call getActiveWorkspace → this).
 */
export const getWorkspacesForUser = cache(async (): Promise<Workspace[]> => {
  const session = await getSession()
  if (!session.userId) return []

  return withUser(session.userId, (client) => findWorkspacesByUserId(client))
})

export async function getActiveWorkspaceId(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value ?? null
}

export const getActiveWorkspace = cache(async (): Promise<Workspace | null> => {
  const [workspaces, activeId] = await Promise.all([getWorkspacesForUser(), getActiveWorkspaceId()])

  if (workspaces.length === 0) return null
  return workspaces.find((w) => w.id === activeId) ?? workspaces[0]
})
