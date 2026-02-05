import { cookies } from 'next/headers'
import { withUser } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { findWorkspacesByUserId } from '@/lib/db/repositories/workspace.repository'
import { ACTIVE_WORKSPACE_COOKIE } from '@/lib/constants'
import type { Workspace } from '@/types/workspace'

export async function getWorkspacesForUser(): Promise<Workspace[]> {
  const session = await getSession()
  if (!session.userId) return []

  return withUser(session.userId, (client) => findWorkspacesByUserId(client))
}

export async function getActiveWorkspaceId(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value ?? null
}

export async function getActiveWorkspace(): Promise<Workspace | null> {
  // Parallelize independent fetches to reduce latency
  const [workspaces, activeId] = await Promise.all([getWorkspacesForUser(), getActiveWorkspaceId()])

  if (workspaces.length === 0) return null
  return workspaces.find((w) => w.id === activeId) ?? workspaces[0]
}
