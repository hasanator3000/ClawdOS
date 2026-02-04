'use client'

import { useRef, useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

interface AIPanelProps {
  isOpen: boolean
  width: number
  onClose: () => void
  onWidthChange: (width: number) => void
  workspaceName?: string
}

export function AIPanel({ isOpen, width, onClose, onWidthChange, workspaceName }: AIPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [isResizing, setIsResizing] = useState(false)
  const pathname = usePathname()

  // Get current page name from pathname
  const pageName = getPageName(pathname)

  // Handle resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX
      onWidthChange(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, onWidthChange])

  if (!isOpen) return null

  return (
    <>
      {/* Resize handle */}
      <div
        className={`w-1 cursor-col-resize hover:bg-[var(--border)] transition-colors ${
          isResizing ? 'bg-[var(--border)]' : ''
        }`}
        onMouseDown={handleMouseDown}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="flex flex-col bg-[var(--card)] border-l border-[var(--border)] overflow-hidden"
        style={{ width }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <h2 className="font-semibold">Clawdbot</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-[var(--hover)] rounded transition-colors"
            aria-label="Close panel"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Context info */}
        <div className="px-4 py-2 text-sm text-[var(--muted)] border-b border-[var(--border)]">
          <div>
            <span className="opacity-70">Workspace:</span>{' '}
            <span className="text-[var(--fg)]">{workspaceName || 'None'}</span>
          </div>
          <div>
            <span className="opacity-70">Page:</span>{' '}
            <span className="text-[var(--fg)]">{pageName}</span>
          </div>
        </div>

        {/* Chat area (placeholder for Phase 3) */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 p-4 flex items-center justify-center text-[var(--muted)]">
            <div className="text-center">
              <div className="mb-2 text-2xl">🤖</div>
              <div>Chat coming soon</div>
              <div className="text-xs mt-1">Phase 3: Agent Core</div>
            </div>
          </div>

          {/* Input (disabled placeholder) */}
          <div className="p-4 border-t border-[var(--border)]">
            <input
              type="text"
              disabled
              placeholder="Chat coming in Phase 3..."
              className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
        </div>
      </div>
    </>
  )
}

function getPageName(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return 'Home'

  const last = segments[segments.length - 1]

  // Capitalize first letter
  return last.charAt(0).toUpperCase() + last.slice(1)
}
