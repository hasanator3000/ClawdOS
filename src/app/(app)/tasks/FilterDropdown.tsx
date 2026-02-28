'use client'

import { useState } from 'react'

interface FilterDropdownProps {
  label: string
  activeColor?: string
  isActive: boolean
  minWidth?: string
  children: (close: () => void) => React.ReactNode
}

export function FilterDropdown({ label, activeColor, isActive, minWidth = '160px', children }: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full md:w-auto px-4 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg hover:border-[var(--neon-dim)] transition-colors text-sm flex items-center gap-2 justify-between"
        style={{ minWidth: undefined, color: isActive ? (activeColor || 'var(--neon)') : 'var(--fg)' }}
      >
        <span>{label}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div
            className="absolute top-full left-0 mt-1 rounded-lg shadow-lg z-20 overflow-hidden backdrop-blur-xl"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', minWidth }}
          >
            {children(() => setIsOpen(false))}
          </div>
        </>
      )}
    </div>
  )
}
