'use client'

import { CommandPalette } from './CommandPalette'
import { AIPanel } from './AIPanel'
import { AIPanelToggle } from './AIPanelToggle'
import { useCommandPalette } from '@/hooks/useCommandPalette'
import { useAIPanel } from '@/hooks/useAIPanel'
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { SECTIONS } from '@/lib/nav/sections'

interface ShellProps {
  children: React.ReactNode
}

/**
 * Shell component wraps the app with command palette and AI panel.
 * Workspace data is read from WorkspaceContext (no props drilling).
 */
export function Shell({ children }: ShellProps) {
  const commandPalette = useCommandPalette()
  const aiPanel = useAIPanel()
  const router = useRouter()
  const pathname = usePathname()

  // Warm-up: prefetch common sections to make navigation feel instant.
  useEffect(() => {
    for (const s of SECTIONS) {
      if (s.path !== pathname) {
        try {
          router.prefetch(s.path)
        } catch {
          // ignore
        }
      }
    }
  }, [router, pathname])

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
          />
        </div>
      )}

      {/* Command Palette (modal) */}
      <CommandPalette isOpen={commandPalette.isOpen} onClose={commandPalette.close} />
    </>
  )
}
