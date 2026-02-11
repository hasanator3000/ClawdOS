import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout'
import { ShellWrapper } from '@/components/shell'
import { getSession } from '@/lib/auth/session'
import { getActiveWorkspace, getWorkspacesForUser } from '@/lib/workspace'
import { WorkspaceProvider } from '@/contexts/WorkspaceContext'

// Layout is kept as stable as possible for snappy client-side navigation.

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session.userId) redirect('/login')

  const [workspace, workspaces] = await Promise.all([getActiveWorkspace(), getWorkspacesForUser()])

  return (
    <WorkspaceProvider initialWorkspace={workspace} initialWorkspaces={workspaces}>
      <ShellWrapper>
        <Sidebar />
        <main className="overflow-y-auto p-6 min-w-0">{children}</main>
      </ShellWrapper>
    </WorkspaceProvider>
  )
}
