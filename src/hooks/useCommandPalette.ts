'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Hook to manage command palette state and keyboard shortcuts.
 * Uses ref pattern (like useAIPanel) to avoid re-attaching listener on every state change.
 */
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false)

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen((prev) => !prev), [])

  // Refs to avoid re-attaching listener on every state change
  const isOpenRef = useRef(isOpen)
  const toggleRef = useRef(toggle)
  const closeRef = useRef(close)

  isOpenRef.current = isOpen
  toggleRef.current = toggle
  closeRef.current = close

  // Keyboard shortcuts - single listener registered on mount
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        toggleRef.current()
      }

      if (e.key === 'Escape' && isOpenRef.current) {
        e.preventDefault()
        closeRef.current()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, []) // Empty deps - listener added once

  return {
    isOpen,
    open,
    close,
    toggle,
  }
}
