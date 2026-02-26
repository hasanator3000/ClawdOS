'use client'

import { useState, useEffect } from 'react'
import { PRIORITY_LABELS, PRIORITY_COLORS } from './constants'

interface PriorityEditorProps {
  priority: number
  onPriorityChange: (p: number) => void
}

export function PriorityEditor({ priority, onPriorityChange }: PriorityEditorProps) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.priority-dropdown')) setOpen(false)
    }
    const timer = setTimeout(() => document.addEventListener('click', handleClick), 0)
    return () => { clearTimeout(timer); document.removeEventListener('click', handleClick) }
  }, [open])

  const handleChange = (p: number) => {
    setOpen(false)
    onPriorityChange(p)
  }

  if (open) {
    return (
      <div className="priority-dropdown flex gap-1 rounded-lg p-1.5 shadow-lg bg-[var(--bg)] border border-[var(--border)]" >
        {[0, 1, 2, 3, 4].map((p) => (
          <button
            type="button"
            key={p}
            onClick={() => handleChange(p)}
            className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
              priority === p ? 'bg-[var(--neon-dim)]' : 'hover:bg-[var(--surface)]'
            }`}
            title={PRIORITY_LABELS[p] || 'None'}
          >
            {p === 0 ? (
              <span className="text-sm text-[var(--muted)]">&mdash;</span>
            ) : (
              <span className="w-3 h-3 rounded-full" style={{ background: PRIORITY_COLORS[p] }} />
            )}
          </button>
        ))}
      </div>
    )
  }

  if (priority > 0) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-[11px] font-semibold cursor-pointer hover:opacity-80 transition-opacity" style={{ color: PRIORITY_COLORS[priority] }}>
        {PRIORITY_LABELS[priority]}
      </button>
    )
  }

  return (
    <button type="button" onClick={() => setOpen(true)} className="opacity-0 group-hover:opacity-100 p-1 transition-opacity" title="Set priority">
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="var(--muted)" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h2V3H3zm4 0v12h10l-4-6 4-6H7z" /></svg>
    </button>
  )
}
