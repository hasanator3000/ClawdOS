'use client'

import { useState, useEffect, useCallback } from 'react'

/**
 * Hook to manage command palette state and keyboard shortcuts
 */
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false)

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen((prev) => !prev), [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // ⌘K (Mac) or Ctrl+K (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        toggle()
      }

      // ESC to close
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault()
        close()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, toggle, close])

  return {
    isOpen,
    open,
    close,
    toggle,
  }
}
