'use client'

import { createPortal } from 'react-dom'
import type { RefObject } from 'react'

interface Workspace {
  id: string
  name: string
}

interface WorkspaceDropdownProps {
  active: Workspace | null
  workspaces: Workspace[]
  filteredWorkspaces: Workspace[]
  pinnedIds: string[]
  isSwitching: boolean
  railExpanded: boolean
  wsDropdownOpen: boolean
  setWsDropdownOpen: (v: boolean) => void
  switchWorkspace: (id: string) => void
  togglePin: (id: string) => void
  wsButtonRef: RefObject<HTMLButtonElement | null>
  wsDropdownRef: RefObject<HTMLDivElement | null>
  isMounted: boolean
}

export function WorkspaceDropdown({
  active,
  workspaces,
  filteredWorkspaces,
  pinnedIds,
  isSwitching,
  railExpanded,
  wsDropdownOpen,
  setWsDropdownOpen,
  switchWorkspace,
  togglePin,
  wsButtonRef,
  wsDropdownRef,
  isMounted,
}: WorkspaceDropdownProps) {
  const exp = railExpanded

  return (
    <div ref={wsDropdownRef} className={`relative w-full mb-2 ${exp ? 'px-3' : 'px-0'}`}>
      <button
        ref={wsButtonRef}
        type="button"
        onClick={() => setWsDropdownOpen(!wsDropdownOpen)}
        className={`flex items-center gap-2 rounded-lg transition-colors text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--card)] ${
          exp ? 'w-full px-3 py-2' : 'w-10 h-10 mx-auto justify-center'
        }`}
        title={active?.name || 'Select workspace'}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-5 h-5 shrink-0">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
        {exp && (
          <span className="text-[13px] truncate">
            {active?.name || 'Workspace'}
          </span>
        )}
      </button>

      {wsDropdownOpen && isMounted && typeof window !== 'undefined' && createPortal(
        (() => {
          const buttonRect = wsButtonRef.current?.getBoundingClientRect()
          if (!buttonRect) return null

          const dropdownStyle: React.CSSProperties = exp
            ? {
                position: 'fixed',
                left: `${buttonRect.left}px`,
                right: `calc(100vw - ${buttonRect.right}px)`,
                bottom: `calc(100vh - ${buttonRect.top}px + 4px)`,
                background: 'rgba(6,6,10,0.97)',
              }
            : {
                position: 'fixed',
                left: `${buttonRect.right + 8}px`,
                bottom: `${window.innerHeight - buttonRect.bottom}px`,
                width: '224px',
                background: 'rgba(6,6,10,0.97)',
              }

          return (
            <div
              ref={wsDropdownRef}
              className="border border-[var(--border)] rounded-lg shadow-lg overflow-hidden z-50 max-h-60 overflow-y-auto"
              style={dropdownStyle}
            >
              <div className="px-3 py-2 text-[9px] font-semibold uppercase tracking-[1.5px] text-[var(--muted-2)] border-b border-[var(--border)]">
                Workspaces
              </div>
              {filteredWorkspaces.map((ws) => {
                const isCurrent = ws.id === active?.id
                const isPinned = pinnedIds.includes(ws.id)
                return (
                  <div
                    key={ws.id}
                    className={`flex items-center hover:bg-[var(--hover)] ${isCurrent ? 'bg-[var(--hover)]' : ''}`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        switchWorkspace(ws.id)
                        setWsDropdownOpen(false)
                      }}
                      disabled={isSwitching}
                      className={`flex-1 text-left px-3 py-2 text-sm ${isCurrent ? 'font-medium text-[var(--neon)]' : 'text-[var(--fg)]'}`}
                    >
                      {isPinned && <span className="mr-1 text-xs">📌</span>}
                      {ws.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => togglePin(ws.id)}
                      className="px-2 py-2 text-[var(--muted)] hover:text-[var(--fg)] transition-colors text-sm"
                      title={isPinned ? 'Unpin' : 'Pin'}
                    >
                      {isPinned ? '★' : '☆'}
                    </button>
                  </div>
                )
              })}
              {workspaces.length === 0 && (
                <div className="px-3 py-2 text-sm text-[var(--muted)]">No workspaces</div>
              )}
            </div>
          )
        })(),
        document.body
      )}
    </div>
  )
}
