'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState, useTransition, useCallback } from 'react'
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
  const [pending, startTransition] = useTransition()

  const [workspaces, setWorkspaces] = useState<Workspace[]>(initialWorkspaces)
  const [activeId, setActiveId] = useState<string | null>(initialActiveWorkspaceId ?? null)
  const [searchQuery, setSearchQuery] = useState('')
  const [pinnedIds, setPinnedIdsState] = useState<string[]>([])

  // Hydrate pinned IDs from localStorage
  useEffect(() => {
    setPinnedIdsState(getPinnedIds())
  }, [])

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

  const linkClass = (href: string) =>
    `block rounded-md px-3 py-2 hover:bg-[var(--hover)] ${pathname === href ? 'bg-[var(--hover)] font-medium' : ''}`

  return (
    <aside className="w-72 border-r border-[var(--border)] bg-[var(--card)] text-[var(--card-fg)] p-4 flex flex-col gap-4">
      <div>
        <div className="font-semibold">LifeOS</div>
        <div className="text-xs text-[var(--muted)] truncate">{username ?? ''}</div>
      </div>

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
                  className={`flex-1 text-left px-3 py-2 text-sm ${
                    isActive ? 'font-medium' : ''
                  }`}
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

      <nav className="space-y-1">
        <Link className={linkClass('/today')} href="/today" prefetch>
          Today
        </Link>
        <Link className={linkClass('/news')} href="/news" prefetch>
          News
        </Link>
      </nav>

      <div className="mt-auto">
        <Link
          className={
            'block w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--hover)]'
          }
          href="/settings"
          prefetch
        >
          Settings
        </Link>
      </div>
    </aside>
  )
}
