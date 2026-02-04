'use client'

import { CommandPalette } from './CommandPalette'
import { AIPanel } from './AIPanel'
import { AIPanelToggle } from './AIPanelToggle'
import { useCommandPalette } from '@/hooks/useCommandPalette'
import { useAIPanel } from '@/hooks/useAIPanel'

interface ShellProps {
  children: React.ReactNode
  workspaceName?: string
  workspaceId?: string
}

/**
 * Shell component wraps the app with command palette and AI panel.
 * This is a client component that manages shell state.
 */
export function Shell({ children, workspaceName, workspaceId }: ShellProps) {
  const commandPalette = useCommandPalette()
  const aiPanel = useAIPanel()

  return (
    <>
      {/* Main content area */}
      <div
        className="min-h-screen flex bg-[var(--bg)] text-[var(--fg)]"
        style={{
          paddingRight: aiPanel.isOpen && aiPanel.isHydrated ? aiPanel.width + 4 : 0,
        }}
      >
        {children}
      </div>

      {/* AI Panel Toggle Button */}
      <AIPanelToggle
        isOpen={aiPanel.isOpen && aiPanel.isHydrated}
        onToggle={aiPanel.toggle}
        panelWidth={aiPanel.isHydrated ? aiPanel.width : 400}
      />

      {/* AI Panel (fixed right) */}
      {aiPanel.isHydrated && (
        <div className="fixed top-0 right-0 h-screen flex">
          <AIPanel
            isOpen={aiPanel.isOpen}
            width={aiPanel.width}
            onClose={aiPanel.close}
            onWidthChange={aiPanel.setWidth}
            workspaceName={workspaceName}
            workspaceId={workspaceId}
          />
        </div>
      )}

      {/* Command Palette (modal) */}
      <CommandPalette isOpen={commandPalette.isOpen} onClose={commandPalette.close} />
    </>
  )
}
