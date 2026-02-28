import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout'
import { ShellWrapper, ContentTopBar } from '@/components/shell'
import { MobileDrawer } from '@/components/shell/MobileDrawer'
import { MobileChatSheet } from '@/components/shell/MobileChatSheet'
import { UpdateBanner } from '@/components/system/UpdateBanner'
import { getSession } from '@/lib/auth/session'
import { getActiveWorkspace, getWorkspacesForUser } from '@/lib/workspace'
import { WorkspaceProvider } from '@/contexts/WorkspaceContext'

// Layout is kept as stable as possible for snappy client-side navigation.

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session.userId) redirect('/login')

  const [workspace, workspaces] = await Promise.all([getActiveWorkspace(), getWorkspacesForUser()])

  // If user has no workspaces, their account is orphaned or deleted.
  // Destroy the session and redirect to login to prevent a broken UI.
  if (workspaces.length === 0 || !workspace) {
    session.destroy()
    redirect('/login')
  }

  return (
    <WorkspaceProvider initialWorkspace={workspace} initialWorkspaces={workspaces}>
      <ShellWrapper>
        <Sidebar />
        <main className="min-w-0 flex flex-col overflow-hidden">
          <div className="shrink-0 px-4 pt-4 md:px-6 md:pt-6">
            <UpdateBanner />
            <ContentTopBar />
          </div>
          <div className="flex-1 px-4 pb-6 md:px-6 overflow-y-auto">{children}</div>
        </main>
      </ShellWrapper>
      <MobileDrawer />
      <MobileChatSheet />
    </WorkspaceProvider>
  )
}
