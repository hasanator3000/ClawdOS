'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

const searchablePages = [
  { path: '/today', name: 'Dashboard', keywords: ['home', 'main', 'dashboard'] },
  { path: '/tasks', name: 'Tasks', keywords: ['todo', 'task', 'work'] },
  { path: '/news', name: 'News', keywords: ['news', 'articles', 'digest'] },
  { path: '/settings', name: 'Settings', keywords: ['settings', 'config', 'preferences'] },
  { path: '/settings/password', name: 'Change Password', keywords: ['password', 'security'] },
  { path: '/settings/telegram', name: 'Telegram Settings', keywords: ['telegram', 'bot'] },
]

export function SearchWidget() {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()

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
    <div className="relative">
      <div className="relative">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
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
          placeholder="Search pages..."
          className="w-full pl-10 pr-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-sm placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--muted)] bg-[var(--card)] px-1.5 py-0.5 rounded border border-[var(--border)]">
          ⌘K
        </div>
      </div>

      {isOpen && filteredPages.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-lg overflow-hidden z-50">
          {filteredPages.map((page) => (
            <button
              key={page.path}
              type="button"
              onClick={() => handleSelect(page.path)}
              className="w-full text-left px-4 py-3 hover:bg-[var(--hover)] transition-colors flex items-center gap-3"
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
                className="text-[var(--muted)]"
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
  )
}
