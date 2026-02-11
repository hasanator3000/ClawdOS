import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout'
import { ShellWrapper, ContentTopBar } from '@/components/shell'
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
        <main className="overflow-y-auto min-w-0 flex flex-col">
          <div className="p-6 pb-0">
            <ContentTopBar />
          </div>
          <div className="flex-1 px-6 pb-6 overflow-y-auto">{children}</div>
        </main>
      </ShellWrapper>
    </WorkspaceProvider>
  )
}
