import { Shell } from './Shell'

interface ShellWrapperProps {
  children: React.ReactNode
}

/**
 * Server component wrapper for Shell.
 * Workspace data is now provided by WorkspaceProvider in layout.tsx.
 */
export async function ShellWrapper({ children }: ShellWrapperProps) {
  return <Shell>{children}</Shell>
}
