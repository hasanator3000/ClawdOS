import { Shell } from './Shell'
import { getActiveWorkspace } from '@/lib/workspace'

interface ShellWrapperProps {
  children: React.ReactNode
}

/**
 * Server component that fetches workspace data and passes to Shell.
 */
export async function ShellWrapper({ children }: ShellWrapperProps) {
  const workspace = await getActiveWorkspace()

  return (
    <Shell workspaceName={workspace?.name} workspaceId={workspace?.id}>
      {children}
    </Shell>
  )
}
