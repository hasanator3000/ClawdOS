'use client'

import { useState, useRef, useMemo } from 'react'
import { DateTimePicker } from './DateTimePicker'
import { parseNaturalDate } from '@/lib/smart-date'

const PRIORITY_OPTIONS = [
  { value: 0, label: 'None', color: '' },
  { value: 1, label: 'Low', color: 'var(--cyan)' },
  { value: 2, label: 'Medium', color: 'var(--warm)' },
  { value: 3, label: 'High', color: 'var(--pink)' },
  { value: 4, label: 'Urgent', color: 'var(--red)' },
] as const

interface TaskCreateFormProps {
  onSubmit: (data: { title: string; priority: number; dueDate?: string; dueTime?: string; startDate?: string; startTime?: string }) => void
  disabled: boolean
}

export function TaskCreateForm({ onSubmit, disabled }: TaskCreateFormProps) {
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState(0)
  const [showPicker, setShowPicker] = useState(false)
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [smartDateDismissed, setSmartDateDismissed] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Detect natural language date in title (SDATE-01, SDATE-03)
  const smartDate = useMemo(() => {
    if (smartDateDismissed || !title.trim()) return null
    return parseNaturalDate(title)
  }, [title, smartDateDismissed])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    // If smart date detected and no manual date set, auto-apply
    const effectiveTitle = smartDate && !dueDate ? smartDate.remaining : title.trim()
    const effectiveDueDate = !dueDate && smartDate ? smartDate.dateStr : dueDate

    onSubmit({
      title: effectiveTitle || title.trim(),
      priority,
      dueDate: effectiveDueDate || undefined,
      dueTime: dueTime || undefined,
      startDate: startDate || undefined,
      startTime: startTime || undefined,
    })

    setTitle('')
    setPriority(0)
    setDueDate('')
    setDueTime('')
    setStartDate('')
    setStartTime('')
    setShowPicker(false)
    setSmartDateDismissed(false)
    inputRef.current?.focus()
  }

  const handleTitleChange = (value: string) => {
    setTitle(value)
    // Reset dismissal when text changes
    if (smartDateDismissed) setSmartDateDismissed(false)
  }

  const handleApplySmartDate = () => {
    if (!smartDate) return
    setDueDate(smartDate.dateStr)
    setTitle(smartDate.remaining)
    setSmartDateDismissed(false)
  }

  const handleDateSave = (date: string, time: string, sDate?: string, sTime?: string) => {
    setDueDate(date)
    setDueTime(time)
    setStartDate(sDate || '')
    setStartTime(sTime || '')
    setShowPicker(false)
  }

  const selectedPriority = PRIORITY_OPTIONS.find((o) => o.value === priority)
  const hasDate = !!dueDate
  const hasRange = !!startDate && !!dueDate
  const showSmartDate = smartDate && !dueDate

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Main row: input + priority + date + add */}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Add a new task... (try &quot;завтра&quot; or &quot;friday&quot;)"
          className="flex-1 px-4 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--neon)] focus:shadow-[0_0_0_1px_var(--neon-dim)] transition-colors"
          disabled={disabled}
        />

        {/* Priority selector */}
        <div className="flex items-center gap-0.5 bg-[var(--card)] border border-[var(--border)] rounded-lg px-1">
          {PRIORITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPriority(opt.value)}
              className={`w-7 h-7 rounded flex items-center justify-center text-xs transition-all ${
                priority === opt.value
                  ? 'scale-110'
                  : 'opacity-40 hover:opacity-70'
              }`}
              title={opt.label}
            >
              {opt.value === 0 ? (
                <span className="text-[var(--muted)]">—</span>
              ) : (
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{
                    background: opt.color,
                    boxShadow: priority === opt.value ? `0 0 6px ${opt.color}` : 'none',
                  }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Date picker trigger */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowPicker(!showPicker)}
            className={`px-2.5 py-2 border rounded-lg transition-colors ${
              hasDate
                ? 'bg-[var(--neon-dim)] border-[var(--neon)] text-[var(--neon)]'
                : 'bg-[var(--card)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--fg)]'
            }`}
            title="Set due date"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
          {showPicker && (
            <DateTimePicker
              date={dueDate}
              time={dueTime}
              startDate={startDate}
              startTime={startTime}
              onSave={handleDateSave}
              onCancel={() => setShowPicker(false)}
            />
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={!title.trim() || disabled}
          className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-opacity hover:opacity-90"
          style={{
            background: 'linear-gradient(135deg, var(--neon), var(--pink))',
            color: 'var(--bg)',
          }}
        >
          Add
        </button>
      </div>

      {/* Smart date preview (SDATE-02) */}
      {showSmartDate && (
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: 'rgba(167, 139, 250, 0.12)', color: 'var(--neon)' }}>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {smartDate.label}
          </span>
          <button
            type="button"
            onClick={handleApplySmartDate}
            className="px-2 py-0.5 rounded text-[var(--neon)] hover:bg-[var(--neon-dim)] transition-colors"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={() => setSmartDateDismissed(true)}
            className="px-1 py-0.5 text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Active selection summary */}
      {(priority > 0 || hasDate) && (
        <div className="flex gap-3 text-xs text-[var(--muted)]">
          {priority > 0 && (
            <span className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: selectedPriority?.color }}
              />
              {selectedPriority?.label}
            </span>
          )}
          {hasDate && (
            <span className="flex items-center gap-1.5">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {hasRange && `${new Date(startDate + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - `}
              {new Date(dueDate + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              {dueTime && ` ${dueTime}`}
            </span>
          )}
        </div>
      )}
    </form>
  )
}
