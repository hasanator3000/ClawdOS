'use client'

import { useState } from 'react'
import type { RecurrenceRule } from '@/lib/db/repositories/task.repository'
import { RECURRENCE_PRESETS, WEEKDAY_NAMES } from './constants'

interface RecurrencePickerProps {
  current: RecurrenceRule | null
  onChange: (rule: RecurrenceRule | null) => void
  onClose: () => void
}

export function RecurrencePicker({ current, onChange, onClose }: RecurrencePickerProps) {
  const [customWeekdays, setCustomWeekdays] = useState<number[]>(
    current?.type === 'custom' ? current.weekdays || [] : []
  )

  const toggleWeekday = (day: number) => {
    setCustomWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    )
  }

  const applyCustom = () => {
    if (customWeekdays.length === 0) return
    onChange({ type: 'custom', interval: 1, weekdays: customWeekdays })
  }

  return (
    <>
    <div className="fixed inset-0 z-10" onClick={onClose} />
    <div
      className="absolute left-0 top-full mt-1 min-w-[220px] rounded-lg shadow-lg z-20 overflow-hidden"
      style={{ background: 'var(--bg)', border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
    >
      {/* Presets */}
      {RECURRENCE_PRESETS.map((preset) => {
        const isActive = current?.type === preset.rule.type && current?.interval === preset.rule.interval
        return (
          <button
            key={preset.label}
            type="button"
            onClick={() => onChange(preset.rule)}
            className={`w-full px-3 py-2 text-left text-sm transition-colors ${isActive ? 'bg-[var(--neon-dim)]' : 'hover:bg-[var(--surface)]'}`}
            style={{ color: isActive ? 'var(--cyan)' : 'var(--fg)' }}
          >
            {preset.label}
          </button>
        )
      })}

      {/* Custom weekdays */}
      <div className="px-3 py-2 border-t border-t-[var(--border)]" >
        <div className="text-[10px] font-mono uppercase mb-1.5 text-[var(--muted)]" >Custom days</div>
        <div className="flex gap-1 mb-1.5">
          {WEEKDAY_NAMES.map((name, i) => (
            <button
              key={name}
              type="button"
              onClick={() => toggleWeekday(i)}
              className="w-7 h-7 rounded text-[10px] font-medium transition-colors"
              style={{
                background: customWeekdays.includes(i) ? 'var(--cyan)' : 'var(--surface)',
                color: customWeekdays.includes(i) ? 'var(--bg)' : 'var(--muted)',
              }}
            >
              {name.slice(0, 2)}
            </button>
          ))}
        </div>
        {customWeekdays.length > 0 && (
          <button
            type="button"
            onClick={applyCustom}
            className="text-xs font-medium transition-colors text-[var(--cyan)]"
            
          >
            Apply custom
          </button>
        )}
      </div>

      {/* Remove */}
      {current && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="w-full px-3 py-2 text-left text-xs transition-colors hover:bg-[var(--surface)]"
          style={{ color: 'var(--red)', borderTop: '1px solid var(--border)' }}
        >
          Remove recurrence
        </button>
      )}
    </div>
    </>
  )
}
