'use client'

import dynamic from 'next/dynamic'
import { useCommandPalette } from '@/hooks/useCommandPalette'
import { useAIPanel } from '@/hooks/useAIPanel'
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { AIPanelProvider } from '@/contexts/AIPanelContext'

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

  const toggleRail = useCallback(() => {
    setRailExpanded((prev) => {
      const next = !prev
      localStorage.setItem(RAIL_STORAGE_KEY, String(next))
      return next
    })
  }, [])

  // Open AI panel when any component dispatches lifeos:ai-prefill
  const openRef = useRef(aiPanel.open)
  openRef.current = aiPanel.open

  useEffect(() => {
    const handlePrefill = () => openRef.current()
    window.addEventListener('lifeos:ai-prefill', handlePrefill)
    return () => window.removeEventListener('lifeos:ai-prefill', handlePrefill)
  }, [])

  const gridColumns = useMemo(() => {
    const rail = railExpanded ? 'var(--rail-w-open)' : 'var(--rail-w)'
    const chat = aiPanel.isOpen && aiPanel.isHydrated ? `${aiPanel.width}px` : '0px'
    return `${rail} 1fr ${chat}`
  }, [railExpanded, aiPanel.isOpen, aiPanel.isHydrated, aiPanel.width])

  const aiPanelCtx = useMemo(
    () => ({ isOpen: aiPanel.isOpen, toggle: aiPanel.toggle, isHydrated: aiPanel.isHydrated }),
    [aiPanel.isOpen, aiPanel.toggle, aiPanel.isHydrated]
  )

  return (
    <AIPanelProvider value={aiPanelCtx}>
      {/* 3-column CSS Grid: rail | content | chat */}
      <div
        className="h-screen relative z-[1]"
        style={{
          display: 'grid',
          gridTemplateColumns: gridColumns,
        }}
      >
        {children}

        {/* AI Panel (third grid column) */}
        {aiPanel.isHydrated && (
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
