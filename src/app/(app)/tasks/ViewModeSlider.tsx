'use client'

import React, { useState, useEffect } from 'react'

export type ViewMode = 'list' | 'calendar' | 'kanban' | 'timeline'

const STORAGE_KEY = 'clawdos:task-view-mode'

const MODES: Array<{ id: ViewMode; label: string; icon: React.ReactNode }> = [
  {
    id: 'list',
    label: 'List',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    ),
  },
  {
    id: 'calendar',
    label: 'Calendar',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: 'kanban',
    label: 'Board',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
      </svg>
    ),
  },
  {
    id: 'timeline',
    label: 'Timeline',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
      </svg>
    ),
  },
]

interface ViewModeSliderProps {
  value: ViewMode
  onChange: (mode: ViewMode) => void
}

export function useViewMode(): [ViewMode, (m: ViewMode) => void] {
  const [mode, setMode] = useState<ViewMode>('list')

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ViewMode | null
    if (saved && MODES.some((m) => m.id === saved)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from localStorage on mount
      setMode(saved)
    }
  }, [])

  const set = (m: ViewMode) => {
    setMode(m)
    localStorage.setItem(STORAGE_KEY, m)
  }

  return [mode, set]
}

export function ViewModeSlider({ value, onChange }: ViewModeSliderProps) {
  const activeIndex = MODES.findIndex((m) => m.id === value)

  return (
    <div
      className="relative flex p-1 rounded-xl bg-[var(--card)] border border-[var(--border)]"
      
    >
      {/* Sliding indicator */}
      <div
        className="absolute top-1 bottom-1 rounded-lg transition-all duration-300 ease-out"
        style={{
          width: `calc(${100 / MODES.length}% - 4px)`,
          left: `calc(${(activeIndex * 100) / MODES.length}% + 2px)`,
          background: 'var(--neon)',
          boxShadow: '0 0 12px var(--neon-glow), 0 0 4px var(--neon-dim)',
          opacity: 0.9,
        }}
      />

      {MODES.map((mode) => {
        const isActive = mode.id === value
        return (
          <button
            key={mode.id}
            type="button"
            onClick={() => onChange(mode.id)}
            className="relative z-10 flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors duration-200"
            style={{ color: isActive ? 'var(--bg)' : 'var(--muted)' }}
          >
            {mode.icon}
            <span className="hidden sm:inline">{mode.label}</span>
          </button>
        )
      })}
    </div>
  )
}
