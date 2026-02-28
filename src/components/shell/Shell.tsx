'use client'

import dynamic from 'next/dynamic'
import { useCommandPalette } from '@/hooks/useCommandPalette'
import { useAIPanel } from '@/hooks/useAIPanel'
import { useEffect, useRef, useState, useMemo } from 'react'
import { AIPanelProvider } from '@/contexts/AIPanelContext'
import { useIsMobile } from '@/hooks/useIsMobile'

const CommandPalette = dynamic(() => import('./CommandPalette').then((m) => m.CommandPalette), {
  ssr: false,
})
const AIPanel = dynamic(() => import('./AIPanel').then((m) => m.AIPanel), {
  ssr: false,
})

const RAIL_STORAGE_KEY = 'clawd-rail-open'

interface ShellProps {
  children: React.ReactNode
}

/**
 * Shell component wraps the app with command palette and AI panel.
 * Uses CSS Grid for 3-column layout: rail | content | chat
 */
export function Shell({ children }: ShellProps) {
  const commandPalette = useCommandPalette()
  const aiPanel = useAIPanel()

  // Rail collapsed/expanded state with localStorage persistence
  const [railExpanded, setRailExpanded] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Hydrate initial value
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration from localStorage
    setRailExpanded(localStorage.getItem(RAIL_STORAGE_KEY) === 'true')

    // Listen for changes from SidebarClient (which dispatches StorageEvent)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === RAIL_STORAGE_KEY) {
        setRailExpanded(e.newValue === 'true')
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  // Open AI panel when any component dispatches clawdos:ai-prefill
  const openRef = useRef(aiPanel.open)
  useEffect(() => { openRef.current = aiPanel.open }, [aiPanel.open])

  useEffect(() => {
    const handlePrefill = () => openRef.current()
    window.addEventListener('clawdos:ai-prefill', handlePrefill)
    return () => window.removeEventListener('clawdos:ai-prefill', handlePrefill)
  }, [])

  const isMobile = useIsMobile()

  const gridColumns = useMemo(() => {
    if (isMobile) return '1fr'
    const rail = railExpanded ? 'var(--rail-w-open)' : 'var(--rail-w)'
    const chat = aiPanel.isOpen && aiPanel.isHydrated ? `${aiPanel.width}px` : '0px'
    return `${rail} 1fr ${chat}`
  }, [isMobile, railExpanded, aiPanel.isOpen, aiPanel.isHydrated, aiPanel.width])

  const aiPanelCtx = useMemo(
    () => ({ isOpen: aiPanel.isOpen, toggle: aiPanel.toggle, isHydrated: aiPanel.isHydrated }),
    [aiPanel.isOpen, aiPanel.toggle, aiPanel.isHydrated]
  )

  return (
    <AIPanelProvider value={aiPanelCtx}>
      {/* 3-column CSS Grid: rail | content | chat */}
      <div
        className="h-screen relative z-[1] overflow-x-hidden max-w-[100vw]"
        style={{
          display: 'grid',
          gridTemplateColumns: gridColumns,
        }}
      >
        {children}

        {/* AI Panel (third grid column) — hidden on mobile, bottom sheet in Phase 20 */}
        {aiPanel.isHydrated && !isMobile && (
          <AIPanel
            isOpen={aiPanel.isOpen}
            width={aiPanel.width}
            onClose={aiPanel.close}
            onToggle={aiPanel.toggle}
            onWidthChange={aiPanel.setWidth}
          />
        )}
      </div>

      {/* Command Palette (modal) */}
      <CommandPalette isOpen={commandPalette.isOpen} onClose={commandPalette.close} />
    </AIPanelProvider>
  )
}

export { RAIL_STORAGE_KEY }
