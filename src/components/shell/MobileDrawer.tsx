'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { SECTIONS } from '@/lib/nav/sections'
import { NAV_ICONS } from '@/components/layout/sidebar/nav-icons'

/** Sections shown in the mobile drawer nav (Settings is in profile icon, not here) */
const DRAWER_SECTIONS = SECTIONS.filter((s) => s.sidebar)

export function MobileDrawer() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { workspace, workspaces, switchWorkspace, isSwitching } = useWorkspace()
  const drawerRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef(0)
  const touchCurrentX = useRef(0)
  const isDragging = useRef(false)

  // Listen for open event from hamburger button
  useEffect(() => {
    const handleOpen = () => setIsOpen(true)
    window.addEventListener('clawdos:drawer-open', handleOpen)
    return () => window.removeEventListener('clawdos:drawer-open', handleOpen)
  }, [])

  // Close on route change
  const prevPathRef = useRef(pathname)
  useEffect(() => {
    if (prevPathRef.current !== pathname) {
      prevPathRef.current = pathname
      // eslint-disable-next-line react-hooks/set-state-in-effect -- close drawer on navigation
      setIsOpen(false)
    }
  }, [pathname])

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  // Swipe-to-close gesture
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchCurrentX.current = e.touches[0].clientX
    isDragging.current = true
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return
    touchCurrentX.current = e.touches[0].clientX
    const delta = touchCurrentX.current - touchStartX.current
    if (delta < 0 && drawerRef.current) {
      drawerRef.current.style.transform = `translateX(${delta}px)`
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (!isDragging.current) return
    isDragging.current = false
    const delta = touchCurrentX.current - touchStartX.current
    if (delta < -80) {
      setIsOpen(false)
    }
    if (drawerRef.current) {
      drawerRef.current.style.transform = ''
    }
  }, [])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={() => setIsOpen(false)}
      />

      {/* Drawer panel */}
      <nav
        ref={drawerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="absolute inset-y-0 left-0 w-[280px] flex flex-col
          border-r border-[var(--border)]
          animate-in slide-in-from-left duration-200"
        style={{
          background: 'var(--bg)',
          paddingBottom: 'var(--mobile-safe-bottom)',
        }}
      >
        {/* Brand header */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-4">
          <span
            className="font-bold text-base"
            style={{
              fontFamily: 'var(--font-space-mono, monospace)',
              color: 'var(--neon)',
              textShadow: '0 0 20px var(--neon-glow)',
            }}
          >
            ClawdOS
          </span>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="ml-auto p-1.5 rounded-lg text-[var(--muted)] active:bg-[var(--hover)] transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Workspace selector */}
        <div className="px-3 mb-2">
          <div className="text-[9px] font-semibold uppercase tracking-[1.5px] text-[var(--muted-2)] px-2 mb-2">
            Workspace
          </div>
          <div className="flex flex-col gap-0.5 max-h-32 overflow-y-auto">
            {workspaces.map((ws) => {
              const isCurrent = ws.id === workspace?.id
              return (
                <button
                  key={ws.id}
                  type="button"
                  onClick={() => switchWorkspace(ws.id)}
                  disabled={isSwitching}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    isCurrent
                      ? 'text-[var(--neon)] font-medium bg-[var(--neon-dim)]'
                      : 'text-[var(--fg)] active:bg-[var(--hover)]'
                  }`}
                >
                  {ws.name}
                </button>
              )
            })}
          </div>
        </div>

        <div className="mx-3 border-t border-[var(--border)] my-2" />

        {/* Navigation */}
        <div className="px-3 flex-1 overflow-y-auto">
          <div className="text-[9px] font-semibold uppercase tracking-[1.5px] text-[var(--muted-2)] px-2 mb-2">
            Pages
          </div>
          <div className="flex flex-col gap-0.5">
            {DRAWER_SECTIONS.map((s) => {
              const isActive = pathname === s.path || pathname.startsWith(s.path + '/')
              return (
                <Link
                  key={s.id}
                  href={s.path}
                  prefetch
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'text-[var(--neon)] font-medium bg-[var(--neon-dim)]'
                      : 'text-[var(--fg)] active:bg-[var(--hover)]'
                  }`}
                >
                  <span className="shrink-0">{NAV_ICONS[s.id] || NAV_ICONS.settings}</span>
                  <span>{s.title}</span>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Footer: settings + logout */}
        <div className="px-3 pb-4 pt-2 border-t border-[var(--border)] mt-auto flex flex-col gap-0.5">
          <Link
            href="/settings"
            prefetch
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              pathname.startsWith('/settings')
                ? 'text-[var(--neon)] font-medium bg-[var(--neon-dim)]'
                : 'text-[var(--fg)] active:bg-[var(--hover)]'
            }`}
          >
            <span className="shrink-0">{NAV_ICONS.settings}</span>
            <span>Settings</span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[var(--red)] active:bg-[var(--hover)] transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-5 h-5">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Log out</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
