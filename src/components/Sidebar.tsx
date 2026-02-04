import SidebarClient from '@/components/SidebarClient'
import { getSession } from '@/lib/session'
import { getActiveWorkspaceId, getWorkspacesForUser } from '@/lib/workspaces'

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
