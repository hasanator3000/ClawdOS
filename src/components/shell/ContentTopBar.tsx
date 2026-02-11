'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAIPanelContext } from '@/contexts/AIPanelContext'

const searchablePages = [
  { path: '/today', name: 'Dashboard', keywords: ['home', 'main', 'dashboard'] },
  { path: '/tasks', name: 'Tasks', keywords: ['todo', 'task', 'work'] },
  { path: '/news', name: 'News', keywords: ['news', 'articles', 'digest'] },
  { path: '/settings', name: 'Settings', keywords: ['settings', 'config', 'preferences'] },
  { path: '/settings/password', name: 'Change Password', keywords: ['password', 'security'] },
  { path: '/settings/telegram', name: 'Telegram Settings', keywords: ['telegram', 'bot'] },
]

export function ContentTopBar() {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()
  const aiPanel = useAIPanelContext()

  const lowerQuery = query.trim().toLowerCase()
  const filteredPages = lowerQuery
    ? searchablePages.filter(
        (page) =>
          page.name.toLowerCase().includes(lowerQuery) ||
          page.keywords.some((kw) => kw.includes(lowerQuery))
      )
    : []

  const handleSelect = useCallback(
    (path: string) => {
      router.push(path)
      setQuery('')
      setIsOpen(false)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- router is stable in practice
    []
  )

  return (
    <div className="flex items-center gap-2.5 mb-6">
      {/* Search */}
      <div className="relative flex-1">
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: 'var(--muted)', opacity: 0.25 }}
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search..."
          className="w-full pl-10 pr-14 py-2.5 rounded-xl text-sm outline-none transition-all"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            color: 'var(--fg)',
          }}
          onFocusCapture={(e) => {
            e.currentTarget.style.borderColor = 'var(--neon)'
            e.currentTarget.style.boxShadow = '0 0 0 1px var(--neon-dim), 0 0 12px var(--neon-dim)'
          }}
          onBlurCapture={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)'
            e.currentTarget.style.boxShadow = 'none'
            setTimeout(() => setIsOpen(false), 200)
          }}
        />
        <div
          className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] px-1.5 py-0.5 rounded"
          style={{ color: 'var(--muted)', border: '1px solid var(--border)' }}
        >
          ⌘K
        </div>

        {/* Search results dropdown */}
        {isOpen && filteredPages.length > 0 && (
          <div
            className="absolute top-full left-0 right-0 mt-2 rounded-xl overflow-hidden z-50"
            style={{
              background: 'rgba(6,6,10,0.97)',
              border: '1px solid var(--border)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
          >
            {filteredPages.map((page) => (
              <button
                key={page.path}
                type="button"
                onClick={() => handleSelect(page.path)}
                className="w-full text-left px-4 py-3 flex items-center gap-3 transition-colors hover:bg-[var(--hover)]"
                style={{ color: 'var(--fg)' }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ color: 'var(--muted)' }}
                >
                  <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                  <polyline points="13 2 13 9 20 9" />
                </svg>
                <span className="text-sm">{page.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chat toggle button — inline next to search */}
      {aiPanel.isHydrated && (
        <button
          type="button"
          onClick={aiPanel.toggle}
          className="flex-shrink-0 flex items-center justify-center w-[38px] h-[38px] rounded-xl transition-all"
          style={{
            background: aiPanel.isOpen ? 'var(--neon-dim)' : 'var(--card)',
            border: `1px solid ${aiPanel.isOpen ? 'var(--neon)' : 'var(--border)'}`,
            color: aiPanel.isOpen ? 'var(--neon)' : 'var(--muted)',
            boxShadow: aiPanel.isOpen ? '0 0 12px var(--neon-dim)' : 'none',
          }}
          aria-label={aiPanel.isOpen ? 'Close AI panel' : 'Open AI panel'}
          title="Toggle Clawdbot (Ctrl+J)"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}
    </div>
  )
}
