'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { setActiveWorkspace } from '@/app/(app)/actions'

export type SidebarWorkspace = {
  id: string
  name: string
  slug: string
  type: 'personal' | 'shared'
}

export default function SidebarClient({
  username,
  initialWorkspaces,
  initialActiveWorkspaceId,
}: {
  username?: string
  initialWorkspaces: SidebarWorkspace[]
  initialActiveWorkspaceId?: string | null
}) {
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()

  const [workspaces, setWorkspaces] = useState<SidebarWorkspace[]>(initialWorkspaces)
  const [activeId, setActiveId] = useState<string | null>(initialActiveWorkspaceId ?? null)

  // Poll workspaces in background (keeps UI fresh without server re-rendering layout).
  useEffect(() => {
    let alive = true
    const tick = async () => {
      try {
        const res = await fetch('/api/workspaces', { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as { workspaces: SidebarWorkspace[] }
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
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)]">
          {workspaces.map((ws) => {
            const isActive = ws.id === active?.id
            return (
              <button
                key={ws.id}
                type="button"
                onClick={() => chooseWorkspace(ws.id)}
                disabled={pending}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--hover)] ${
                  isActive ? 'font-medium bg-[var(--hover)]' : ''
                }`}
              >
                {ws.name}
                <span className="ml-2 text-xs text-[var(--muted)]">({ws.type})</span>
              </button>
            )
          })}
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
