'use client'

import Link from 'next/link'
import { createPortal } from 'react-dom'
import type { RefObject } from 'react'

interface UserMenuProps {
  username: string | undefined
  initials: string
  railExpanded: boolean
  userMenuOpen: boolean
  setUserMenuOpen: (v: boolean) => void
  handleLogout: () => void
  userButtonRef: RefObject<HTMLButtonElement | null>
  userMenuRef: RefObject<HTMLDivElement | null>
  isMounted: boolean
}

export function UserMenu({
  username,
  initials,
  railExpanded,
  userMenuOpen,
  setUserMenuOpen,
  handleLogout,
  userButtonRef,
  userMenuRef,
  isMounted,
}: UserMenuProps) {
  const exp = railExpanded

  return (
    <>
      <div className={`flex items-center w-full ${exp ? 'px-3.5' : 'justify-center'}`}>
        {/* Avatar with spinning ring */}
        <button
          ref={userButtonRef}
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

      {userMenuOpen && isMounted && typeof window !== 'undefined' && createPortal(
        (() => {
          const buttonRect = userButtonRef.current?.getBoundingClientRect()
          if (!buttonRect) return null

          const dropdownStyle: React.CSSProperties = exp
            ? {
                position: 'fixed',
                left: `${buttonRect.left - 8}px`,
                right: `calc(100vw - ${buttonRect.right + 8}px)`,
                bottom: `calc(100vh - ${buttonRect.top}px + 4px)`,
                background: 'rgba(6,6,10,0.97)',
              }
            : {
                position: 'fixed',
                left: `${buttonRect.right + 8}px`,
                bottom: `${window.innerHeight - buttonRect.bottom}px`,
                width: '180px',
                background: 'rgba(6,6,10,0.97)',
              }

          return (
            <div
              ref={userMenuRef}
              className="border border-[var(--border)] rounded-lg shadow-lg overflow-hidden z-50"
              style={dropdownStyle}
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
          )
        })(),
        document.body
      )}
    </>
  )
}
