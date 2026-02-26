'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { SIDEBAR_SECTIONS } from '@/lib/nav/sections'
import { NAV_ICONS } from './sidebar/nav-icons'
import { WorkspaceDropdown } from './sidebar/WorkspaceDropdown'
import { UserMenu } from './sidebar/UserMenu'

const PINS_STORAGE_KEY = 'clawdos.pinned-workspaces'
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

export default function SidebarClient({ username }: { username?: string }) {
  const pathname = usePathname()
  const { workspace: active, workspaces, switchWorkspace, isSwitching } = useWorkspace()

  const [pinnedIds, setPinnedIdsState] = useState<string[]>([])
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [wsDropdownOpen, setWsDropdownOpen] = useState(false)
  const [railExpanded, setRailExpanded] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const userButtonRef = useRef<HTMLButtonElement>(null)
  const wsDropdownRef = useRef<HTMLDivElement>(null)
  const wsButtonRef = useRef<HTMLButtonElement>(null)

  // Hydrate state from localStorage
  useEffect(() => {
    setIsMounted(true)
    setPinnedIdsState(getPinnedIds())
    setRailExpanded(localStorage.getItem(RAIL_STORAGE_KEY) === 'true')

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
      queueMicrotask(() => {
        window.dispatchEvent(new StorageEvent('storage', { key: RAIL_STORAGE_KEY, newValue: String(next) }))
      })
      return next
    })
  }, [])

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        userMenuRef.current && !userMenuRef.current.contains(target) &&
        userButtonRef.current && !userButtonRef.current.contains(target)
      ) {
        setUserMenuOpen(false)
      }
      if (wsDropdownRef.current && !wsDropdownRef.current.contains(target)) {
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
    ? username.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  const exp = railExpanded

  return (
    <nav
      className="flex flex-col gap-1 border-r border-[var(--border)] overflow-y-auto overflow-x-visible h-screen"
      style={{ background: 'rgba(6,6,10,0.92)', padding: '20px 0' }}
    >
      {/* Brand + toggle */}
      <div className={`flex items-center w-full mb-7 min-h-8 ${exp ? 'px-3 gap-2' : 'justify-center'}`}>
        <button type="button" onClick={toggleRail} className="shrink-0 flex items-center bg-transparent border-none p-0 cursor-pointer" title={exp ? 'Collapse sidebar' : 'Expand sidebar'}>
          <span className="font-bold whitespace-nowrap" style={{ fontFamily: 'var(--font-space-mono, monospace)', fontSize: '16px', color: 'var(--neon)', letterSpacing: '0.5px', textShadow: '0 0 20px var(--neon-glow)' }}>
            {exp ? 'ClawdOS' : 'C'}
          </span>
        </button>
        {exp && (
          <button type="button" onClick={toggleRail} className="w-6 h-6 border border-[var(--border)] rounded-md flex items-center justify-center text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[rgba(255,255,255,0.06)] transition-colors ml-auto shrink-0 bg-[var(--card)]"  title="Collapse sidebar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 rotate-180"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        )}
      </div>

      {/* Section label */}
      {exp && (
        <div className="w-full px-3 mb-1 flex items-center min-h-5">
          <span className="text-[9px] font-semibold uppercase tracking-[1.5px] text-[var(--muted-2)] whitespace-nowrap">Pages</span>
        </div>
      )}

      {/* Navigation */}
      {SIDEBAR_SECTIONS.map((s) => {
        const isActive = pathname === s.path
        return (
          <Link key={s.id} href={s.path} prefetch
            className={`relative flex items-center rounded-xl transition-colors whitespace-nowrap ${exp ? 'h-10 justify-start px-3 gap-3' : 'h-10 w-10 mx-auto justify-center'} ${isActive ? 'text-[var(--neon)]' : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--card)]'}`}
          >
            {isActive && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r" style={{ background: 'var(--neon)', boxShadow: '0 0 8px var(--neon-glow)' }} />
            )}
            <span className="shrink-0">{NAV_ICONS[s.id] || NAV_ICONS.settings}</span>
            {exp && <span className="text-[13px] font-normal">{s.title}</span>}
          </Link>
        )
      })}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Workspace selector */}
      <WorkspaceDropdown
        active={active}
        workspaces={workspaces}
        filteredWorkspaces={filteredWorkspaces}
        pinnedIds={pinnedIds}
        isSwitching={isSwitching}
        railExpanded={railExpanded}
        wsDropdownOpen={wsDropdownOpen}
        setWsDropdownOpen={setWsDropdownOpen}
        switchWorkspace={switchWorkspace}
        togglePin={togglePin}
        wsButtonRef={wsButtonRef}
        wsDropdownRef={wsDropdownRef}
        isMounted={isMounted}
      />

      {/* User footer */}
      <div className="relative w-full border-t border-[var(--border)] pt-3 mt-2">
        <UserMenu
          username={username}
          initials={initials}
          railExpanded={railExpanded}
          userMenuOpen={userMenuOpen}
          setUserMenuOpen={setUserMenuOpen}
          handleLogout={handleLogout}
          userButtonRef={userButtonRef}
          userMenuRef={userMenuRef}
          isMounted={isMounted}
        />
      </div>
    </nav>
  )
}
