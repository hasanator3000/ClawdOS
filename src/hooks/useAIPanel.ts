'use client'

import { useState, useEffect, useCallback } from 'react'

function isTypingTarget(el: EventTarget | null) {
  const node = el as HTMLElement | null
  if (!node) return false
  const tag = node.tagName?.toLowerCase()
  return tag === 'input' || tag === 'textarea' || (node as any).isContentEditable
}

const STORAGE_KEY = 'lifeos.ai-panel'
const DEFAULT_WIDTH = 400
const MIN_WIDTH = 300
const MAX_WIDTH = 600

interface AIPanelState {
  isOpen: boolean
  width: number
}

function getStoredState(): AIPanelState {
  if (typeof window === 'undefined') {
    return { isOpen: false, width: DEFAULT_WIDTH }
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch {
    // Ignore parse errors
  }
  return { isOpen: false, width: DEFAULT_WIDTH }
}

function storeState(state: AIPanelState): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore storage errors
  }
}

/**
 * Hook to manage AI panel state with persistence
 */
export function useAIPanel() {
  const [state, setState] = useState<AIPanelState>({ isOpen: false, width: DEFAULT_WIDTH })
  const [isHydrated, setIsHydrated] = useState(false)

  // Hydrate from localStorage on mount
  useEffect(() => {
    setState(getStoredState())
    setIsHydrated(true)
  }, [])

  // Persist state changes
  useEffect(() => {
    if (isHydrated) {
      storeState(state)
    }
  }, [state, isHydrated])

  const open = useCallback(() => {
    setState((s) => ({ ...s, isOpen: true }))
  }, [])

  const close = useCallback(() => {
    setState((s) => ({ ...s, isOpen: false }))
  }, [])

  const toggle = useCallback(() => {
    setState((s) => ({ ...s, isOpen: !s.isOpen }))
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // ⌘J (Mac) or Ctrl+J (Windows/Linux) to toggle AI panel
      // (Chosen to avoid colliding with Cmd/Ctrl+K command palette)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        // Allow in inputs only if Shift is held (so we don't break common text editing)
        if (isTypingTarget(e.target) && !e.shiftKey) return
        e.preventDefault()
        toggle()
      }

      // ESC closes panel when open
      if (e.key === 'Escape' && state.isOpen) {
        e.preventDefault()
        close()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [state.isOpen, toggle, close])

  const setWidth = useCallback((width: number) => {
    const clampedWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width))
    setState((s) => ({ ...s, width: clampedWidth }))
  }, [])

  return {
    isOpen: state.isOpen,
    width: state.width,
    minWidth: MIN_WIDTH,
    maxWidth: MAX_WIDTH,
    open,
    close,
    toggle,
    setWidth,
    isHydrated,
  }
}
