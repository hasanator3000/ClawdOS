import SidebarClient from './SidebarClient'
import { getSession } from '@/lib/auth/session'
import { getActiveWorkspaceId, getWorkspacesForUser } from '@/lib/workspace'

export default async function Sidebar() {
  const session = await getSession()
  const workspaces = await getWorkspacesForUser()
  const activeWorkspaceId = await getActiveWorkspaceId()

  return (
    <SidebarClient
      username={session.username}
      initialWorkspaces={workspaces}
      initialActiveWorkspaceId={activeWorkspaceId}
    />
  )
}
