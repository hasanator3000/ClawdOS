'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { SIDEBAR_SECTIONS } from '@/lib/nav/sections'

const PINS_STORAGE_KEY = 'lifeos.pinned-workspaces'
const RAIL_STORAGE_KEY = 'clawd-rail-open'

function getPinnedIds(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(PINS_STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function setPinnedIds(ids: string[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(PINS_STORAGE_KEY, JSON.stringify(ids))
  } catch {
    // ignore
  }
}

// SVG icons for nav items
const NAV_ICONS: Record<string, React.ReactNode> = {
  today: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-5 h-5">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  news: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-5 h-5">
      <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
      <path d="M18 14h-8M15 18h-5" />
      <path d="M10 6h8v4h-8V6Z" />
    </svg>
  ),
  tasks: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-5 h-5">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-5 h-5">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.18V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 3.09 14H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 10 3.09V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
}

export default function SidebarClient({ username }: { username?: string }) {
  const pathname = usePathname()
  const { workspace: active, workspaces, switchWorkspace, isSwitching } = useWorkspace()

  const [pinnedIds, setPinnedIdsState] = useState<string[]>([])
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [wsDropdownOpen, setWsDropdownOpen] = useState(false)
  const [railExpanded, setRailExpanded] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const wsDropdownRef = useRef<HTMLDivElement>(null)

  // Hydrate state from localStorage
  useEffect(() => {
    setPinnedIdsState(getPinnedIds())
    setRailExpanded(localStorage.getItem(RAIL_STORAGE_KEY) === 'true')

    // Listen for storage changes from Shell component
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
      // Defer the cross-component notification so it doesn't fire mid-render
      queueMicrotask(() => {
        window.dispatchEvent(new StorageEvent('storage', { key: RAIL_STORAGE_KEY, newValue: String(next) }))
      })
      return next
    })
  }, [])

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
      if (wsDropdownRef.current && !wsDropdownRef.current.contains(e.target as Node)) {
        setWsDropdownOpen(false)
      }
    }
    if (userMenuOpen || wsDropdownOpen) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [userMenuOpen, wsDropdownOpen])

  const togglePin = useCallback((workspaceId: string) => {
    setPinnedIdsState((prev) => {
      const newPins = prev.includes(workspaceId)
        ? prev.filter((id) => id !== workspaceId)
        : [...prev, workspaceId]
      setPinnedIds(newPins)
      return newPins
    })
  }, [])

  const filteredWorkspaces = useMemo(() => {
    return [...workspaces].sort((a, b) => {
      const aPinned = pinnedIds.includes(a.id)
      const bPinned = pinnedIds.includes(b.id)
      if (aPinned && !bPinned) return -1
      if (!aPinned && bPinned) return 1
      return a.name.localeCompare(b.name)
    })
  }, [workspaces, pinnedIds])

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      window.location.href = '/login'
    } catch {
      window.location.href = '/login'
    }
  }

  const initials = username
    ? username
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?'

  const exp = railExpanded

  return (
    <nav
      className="flex flex-col gap-1 border-r border-[var(--border)] overflow-hidden h-screen"
      style={{
        background: 'rgba(6,6,10,0.7)',
        backdropFilter: 'blur(20px)',
        padding: '20px 0',
      }}
    >
      {/* Brand + toggle */}
      <div className={`flex items-center w-full mb-7 min-h-8 ${exp ? 'px-3 gap-2' : 'justify-center'}`}>
        <button
          type="button"
          onClick={toggleRail}
          className="shrink-0 flex items-center bg-transparent border-none p-0 cursor-pointer"
          title={exp ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          <span
            className="text-lg font-bold"
            style={{
              fontFamily: 'var(--font-space-mono, monospace)',
              color: 'var(--neon)',
              letterSpacing: '-1px',
              textShadow: '0 0 20px var(--neon-glow)',
            }}
          >
            C
          </span>
          {exp && (
            <span
              className="font-bold whitespace-nowrap"
              style={{
                fontFamily: 'var(--font-space-mono, monospace)',
                fontSize: '15px',
                letterSpacing: '1px',
                marginLeft: '-2px',
              }}
            >
              lawdOS
            </span>
          )}
        </button>
        {exp && (
          <button
            type="button"
            onClick={toggleRail}
            className="w-6 h-6 border border-[var(--border)] rounded-md flex items-center justify-center text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[rgba(255,255,255,0.06)] transition-all ml-auto shrink-0"
            style={{ background: 'var(--card)' }}
            title="Collapse sidebar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 rotate-180">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}
      </div>

      {/* Section label */}
      {exp && (
        <div className="w-full px-3 mb-1 flex items-center min-h-5">
          <span className="text-[9px] font-semibold uppercase tracking-[1.5px] text-[var(--muted-2)] whitespace-nowrap">
            Pages
          </span>
        </div>
      )}

      {/* Navigation */}
      {SIDEBAR_SECTIONS.map((s) => {
        const isActive = pathname === s.path
        return (
          <Link
            key={s.id}
            href={s.path}
            prefetch
            className={`relative flex items-center rounded-xl transition-colors whitespace-nowrap ${
              exp ? 'h-10 justify-start px-3 gap-3' : 'h-10 w-10 mx-auto justify-center'
            } ${
              isActive
                ? 'text-[var(--neon)]'
                : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--card)]'
            }`}
          >
            {/* Active indicator bar */}
            {isActive && (
              <span
                className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r"
                style={{
                  background: 'var(--neon)',
                  boxShadow: '0 0 8px var(--neon-glow)',
                }}
              />
            )}
            <span className="shrink-0">{NAV_ICONS[s.id] || NAV_ICONS.settings}</span>
            {exp && <span className="text-[13px] font-normal">{s.title}</span>}
          </Link>
        )
      })}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Workspace selector */}
      <div ref={wsDropdownRef} className="relative w-full px-3 mb-2">
        <button
          type="button"
          onClick={() => setWsDropdownOpen(!wsDropdownOpen)}
          className={`flex items-center gap-2 rounded-lg transition-all text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--card)] ${
            exp ? 'w-full px-3 py-2' : 'w-full justify-center py-2'
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

        {wsDropdownOpen && (
          <div
            className="absolute bottom-full left-3 right-3 mb-1 border border-[var(--border)] rounded-lg shadow-lg overflow-hidden z-50 max-h-60 overflow-y-auto"
            style={{ background: 'rgba(6,6,10,0.95)', backdropFilter: 'blur(20px)' }}
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
        )}
      </div>

      {/* User footer */}
      <div ref={userMenuRef} className="relative w-full border-t border-[var(--border)] pt-3 mt-2">
        <div className={`flex items-center w-full ${exp ? 'px-3.5' : 'justify-center'}`}>
          {/* Avatar with spinning ring */}
          <button
            type="button"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="relative w-9 h-9 shrink-0 cursor-pointer"
            title={username || 'User'}
          >
            <span
              className="absolute rounded-full"
              style={{
                inset: '-3px',
                border: '1.5px solid transparent',
                borderTopColor: 'var(--neon)',
                borderRightColor: 'var(--pink)',
                animation: 'spin 4s linear infinite',
              }}
            />
            <span
              className="absolute inset-0 flex items-center justify-center text-xs font-bold"
              style={{ fontFamily: 'var(--font-space-mono, monospace)' }}
            >
              {initials}
            </span>
            <span
              className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full"
              style={{
                background: 'var(--green)',
                border: '2px solid var(--bg)',
                boxShadow: '0 0 6px rgba(110,231,183,0.5)',
              }}
            />
          </button>

          {exp && (
            <div className="flex flex-col ml-2.5 whitespace-nowrap">
              <span className="text-xs font-medium">{username || 'User'}</span>
              <span className="text-[10px] text-[var(--muted-2)]">Free</span>
            </div>
          )}
        </div>

        {userMenuOpen && (
          <div
            className="absolute bottom-full left-2 right-2 mb-1 border border-[var(--border)] rounded-lg shadow-lg overflow-hidden z-50"
            style={{ background: 'rgba(6,6,10,0.95)', backdropFilter: 'blur(20px)' }}
          >
            <Link
              href="/settings"
              onClick={() => setUserMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-[var(--hover)] transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-4 h-4">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.18V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 3.09 14H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 10 3.09V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              Settings
            </Link>
            <div className="border-t border-[var(--border)]" />
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-[var(--red)] hover:bg-[var(--hover)] transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-4 h-4">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Log out
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}
