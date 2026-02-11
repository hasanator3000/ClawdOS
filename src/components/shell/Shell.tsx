'use client'

import { CommandPalette } from './CommandPalette'
import { AIPanel } from './AIPanel'
import { useCommandPalette } from '@/hooks/useCommandPalette'
import { useAIPanel } from '@/hooks/useAIPanel'
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { SECTIONS } from '@/lib/nav/sections'
import { AIPanelProvider } from '@/contexts/AIPanelContext'

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
  const router = useRouter()
  const pathname = usePathname()

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- router object is stable in practice
  }, [pathname])

  // Open AI panel when any component dispatches lifeos:ai-prefill
  const openRef = useRef(aiPanel.open)
  openRef.current = aiPanel.open

  useEffect(() => {
    const handlePrefill = () => openRef.current()
    window.addEventListener('lifeos:ai-prefill', handlePrefill)
    return () => window.removeEventListener('lifeos:ai-prefill', handlePrefill)
  }, [])

  const railWidth = railExpanded ? 'var(--rail-w-open)' : 'var(--rail-w)'
  const chatWidth = aiPanel.isOpen && aiPanel.isHydrated ? `${aiPanel.width}px` : '0px'

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
          gridTemplateColumns: `${railWidth} 1fr ${chatWidth}`,
          transition: 'grid-template-columns 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
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
