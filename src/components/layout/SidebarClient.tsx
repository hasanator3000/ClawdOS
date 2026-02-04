'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, useTransition, useCallback, useRef } from 'react'
import { setActiveWorkspace } from '@/app/(app)/actions'
import type { Workspace } from '@/types/workspace'

const PINS_STORAGE_KEY = 'lifeos.pinned-workspaces'

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

export default function SidebarClient({
  username,
  initialWorkspaces,
  initialActiveWorkspaceId,
}: {
  username?: string
  initialWorkspaces: Workspace[]
  initialActiveWorkspaceId?: string | null
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [workspaces, setWorkspaces] = useState<Workspace[]>(initialWorkspaces)
  const [activeId, setActiveId] = useState<string | null>(initialActiveWorkspaceId ?? null)
  const [searchQuery, setSearchQuery] = useState('')
  const [pinnedIds, setPinnedIdsState] = useState<string[]>([])
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  // Hydrate pinned IDs from localStorage
  useEffect(() => {
    setPinnedIdsState(getPinnedIds())
  }, [])

  // Close user menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }

    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [userMenuOpen])

  // Poll workspaces in background (keeps UI fresh without server re-rendering layout).
  useEffect(() => {
    let alive = true
    const tick = async () => {
      try {
        const res = await fetch('/api/workspaces', { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as { workspaces: Workspace[] }
        if (!alive) return
        setWorkspaces(data.workspaces)
      } catch {
        // ignore
      }
    }

    tick()
    const id = window.setInterval(tick, 30_000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [])

  // Toggle pin for a workspace
  const togglePin = useCallback((workspaceId: string) => {
    setPinnedIdsState((prev) => {
      const newPins = prev.includes(workspaceId)
        ? prev.filter((id) => id !== workspaceId)
        : [...prev, workspaceId]
      setPinnedIds(newPins)
      return newPins
    })
  }, [])

  // Filter and sort workspaces
  const filteredWorkspaces = useMemo(() => {
    let filtered = workspaces

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((ws) => ws.name.toLowerCase().includes(query))
    }

    // Sort: pinned first, then alphabetically
    return [...filtered].sort((a, b) => {
      const aPinned = pinnedIds.includes(a.id)
      const bPinned = pinnedIds.includes(b.id)
      if (aPinned && !bPinned) return -1
      if (!aPinned && bPinned) return 1
      return a.name.localeCompare(b.name)
    })
  }, [workspaces, searchQuery, pinnedIds])

  const active = useMemo(() => {
    return workspaces.find((w) => w.id === activeId) ?? workspaces[0]
  }, [workspaces, activeId])

  async function chooseWorkspace(id: string) {
    setActiveId(id) // optimistic
    startTransition(async () => {
      try {
        await setActiveWorkspace(id)
      } catch {
        // revert best-effort
        setActiveId(active?.id ?? null)
      }
    })
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
    } catch {
      // Force redirect anyway
      router.push('/login')
    }
  }

  const linkClass = (href: string) =>
    `block rounded-md px-3 py-2 hover:bg-[var(--hover)] ${pathname === href ? 'bg-[var(--hover)] font-medium' : ''}`

  // Get user initials for avatar
  const initials = username
    ? username
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?'

  return (
    <aside className="w-72 border-r border-[var(--border)] bg-[var(--card)] text-[var(--card-fg)] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border)]">
        <Link href="/today" className="font-semibold text-lg hover:opacity-80 transition-opacity">
          LifeOS
        </Link>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Workspaces */}
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wide text-[var(--muted)]">Workspace</div>

          {/* Search input */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search workspaces..."
            className="w-full px-3 py-1.5 text-sm bg-[var(--bg)] border border-[var(--border)] rounded-md placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--fg)]"
          />

          <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] max-h-48 overflow-y-auto">
            {filteredWorkspaces.map((ws) => {
              const isActive = ws.id === active?.id
              const isPinned = pinnedIds.includes(ws.id)
              return (
                <div
                  key={ws.id}
                  className={`flex items-center hover:bg-[var(--hover)] ${
                    isActive ? 'bg-[var(--hover)]' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => chooseWorkspace(ws.id)}
                    disabled={pending}
                    className={`flex-1 text-left px-3 py-2 text-sm ${isActive ? 'font-medium' : ''}`}
                  >
                    {isPinned && <span className="mr-1">📌</span>}
                    {ws.name}
                    <span className="ml-2 text-xs text-[var(--muted)]">({ws.type})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => togglePin(ws.id)}
                    className="px-2 py-2 text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
                    title={isPinned ? 'Unpin' : 'Pin'}
                  >
                    {isPinned ? '★' : '☆'}
                  </button>
                </div>
              )
            })}
            {filteredWorkspaces.length === 0 && searchQuery ? (
              <div className="px-3 py-2 text-sm text-[var(--muted)]">No workspaces found</div>
            ) : null}
            {workspaces.length === 0 ? (
              <div className="px-3 py-2 text-sm text-[var(--muted)]">No workspaces</div>
            ) : null}
          </div>
        </div>

        {/* Navigation */}
        <nav className="space-y-1">
          <Link className={linkClass('/today')} href="/today" prefetch>
            <span className="flex items-center gap-2">
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
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              Dashboard
            </span>
          </Link>
          <Link className={linkClass('/news')} href="/news" prefetch>
            <span className="flex items-center gap-2">
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
                <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
                <path d="M18 14h-8" />
                <path d="M15 18h-5" />
                <path d="M10 6h8v4h-8V6Z" />
              </svg>
              News
            </span>
          </Link>
          <Link className={linkClass('/tasks')} href="/tasks" prefetch>
            <span className="flex items-center gap-2">
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
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
              Tasks
            </span>
          </Link>
        </nav>
      </div>

      {/* User section at bottom */}
      <div ref={userMenuRef} className="relative border-t border-[var(--border)]">
        <button
          type="button"
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          className="w-full p-3 flex items-center gap-3 hover:bg-[var(--hover)] transition-colors"
        >
          {/* Avatar */}
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium">
            {initials}
          </div>

          {/* User info */}
          <div className="flex-1 text-left">
            <div className="text-sm font-medium truncate">{username || 'User'}</div>
            <div className="text-xs text-[var(--muted)]">Free plan</div>
          </div>

          {/* Chevron */}
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
            className={`text-[var(--muted)] transition-transform ${userMenuOpen ? 'rotate-180' : ''}`}
          >
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>

        {/* Dropdown menu */}
        {userMenuOpen && (
          <div className="absolute bottom-full left-0 right-0 mb-1 mx-2 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg overflow-hidden">
            {/* Close button */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]">
              <span className="text-xs text-[var(--muted)] uppercase tracking-wide">Menu</span>
              <button
                type="button"
                onClick={() => setUserMenuOpen(false)}
                className="p-1 hover:bg-[var(--hover)] rounded transition-colors text-[var(--muted)] hover:text-[var(--fg)]"
                aria-label="Close menu"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
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

            <Link
              href="/settings"
              onClick={() => setUserMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-[var(--hover)] transition-colors"
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
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              Settings
            </Link>

            <div className="border-t border-[var(--border)]" />

            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-500 hover:bg-[var(--hover)] transition-colors"
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
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Log out
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
