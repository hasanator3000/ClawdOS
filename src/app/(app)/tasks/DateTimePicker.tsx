'use client'

import { useState, useEffect, useRef } from 'react'
import { pad, toDateStr, getMonthGrid } from '@/lib/date-utils'

interface DateTimePickerProps {
  date: string       // "YYYY-MM-DD" or "" (end/due date)
  time: string       // "HH:MM" or ""
  startDate?: string // "YYYY-MM-DD" or ""
  startTime?: string // "HH:MM" or ""
  onSave: (date: string, time: string, startDate?: string, startTime?: string) => void
  onCancel: () => void
}

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function DateTimePicker({ date, time, startDate: initStartDate, startTime, onSave, onCancel }: DateTimePickerProps) {
  const today = new Date()
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate())

  // Parse initial date or default to current month
  const initDate = date ? new Date(date + 'T00:00') : today
  const [viewYear, setViewYear] = useState(initDate.getFullYear())
  const [viewMonth, setViewMonth] = useState(initDate.getMonth())
  const [selectedDate, setSelectedDate] = useState(date)
  const [selectedHour, setSelectedHour] = useState(() => {
    if (!time) return ''
    return time.split(':')[0] || ''
  })
  const [selectedMinute, setSelectedMinute] = useState(() => {
    if (!time) return ''
    return time.split(':')[1] || ''
  })
  const [showTime, setShowTime] = useState(!!time)
  const [showDuration, setShowDuration] = useState(!!initStartDate)
  const [startDateVal, setStartDateVal] = useState(initStartDate || '')
  const [selectingStart, setSelectingStart] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onCancel()
    }
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handler) }
  }, [onCancel])

  const grid = getMonthGrid(viewYear, viewMonth)

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11) }
    else setViewMonth(viewMonth - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0) }
    else setViewMonth(viewMonth + 1)
  }

  const handleDayClick = (day: number) => {
    const dateStr = toDateStr(viewYear, viewMonth, day)
    if (showDuration && selectingStart) {
      setStartDateVal(dateStr)
      setSelectingStart(false)
    } else {
      setSelectedDate(dateStr)
    }
  }

  const handleQuickDate = (offset: number) => {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    const str = toDateStr(d.getFullYear(), d.getMonth(), d.getDate())
    setSelectedDate(str)
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
  }

  const handleSave = () => {
    const timeStr = selectedHour && selectedMinute ? `${pad(Number(selectedHour))}:${pad(Number(selectedMinute))}` : ''
    onSave(selectedDate, timeStr, showDuration ? startDateVal : '', '')
  }

  const handleClear = () => {
    onSave('', '', '', '')
  }

  return (
    <div
      ref={ref}
      className="fixed left-4 right-4 md:left-auto md:right-0 md:absolute top-auto md:top-full bottom-20 md:bottom-auto mt-2 z-30 rounded-xl shadow-2xl p-4 md:w-[280px]"
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px var(--border)',
      }}
    >
      {/* Quick presets */}
      <div className="flex gap-1.5 mb-3">
        {[
          { label: 'Today', offset: 0 },
          { label: 'Tomorrow', offset: 1 },
          { label: '+7d', offset: 7 },
        ].map((q) => (
          <button
            key={q.label}
            type="button"
            onClick={() => handleQuickDate(q.offset)}
            className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
              selectedDate === (() => { const d = new Date(); d.setDate(d.getDate() + q.offset); return toDateStr(d.getFullYear(), d.getMonth(), d.getDate()) })()
                ? 'bg-[var(--neon-dim)] text-[var(--neon)]'
                : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface)]'
            }`}
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={prevMonth} className="p-1 rounded hover:bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--fg)] transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <span className="text-sm font-medium text-[var(--fg)]" >
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button type="button" onClick={nextMonth} className="p-1 rounded hover:bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--fg)] transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-0 mb-1">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-[10px] font-mono py-1 text-[var(--muted)]" >{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0">
        {grid.flat().map((day, i) => {
          if (day === null) return <div key={`e${i}`} />
          const dateStr = toDateStr(viewYear, viewMonth, day)
          const isSelected = dateStr === selectedDate
          const isStart = showDuration && dateStr === startDateVal
          const isInRange = showDuration && startDateVal && selectedDate && dateStr >= startDateVal && dateStr <= selectedDate
          const isToday = dateStr === todayStr
          const isPast = dateStr < todayStr
          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => handleDayClick(day)}
              className={`w-full aspect-square flex items-center justify-center text-xs rounded-lg transition-all ${
                isSelected || isStart
                  ? ''
                  : isToday
                    ? 'font-bold'
                    : isPast
                      ? 'opacity-35'
                      : 'hover:bg-[var(--surface)]'
              }`}
              style={
                isSelected
                  ? { background: 'var(--neon)', color: 'var(--bg)', fontWeight: 600, boxShadow: '0 0 8px var(--neon-glow)' }
                  : isStart
                    ? { background: 'var(--cyan)', color: 'var(--bg)', fontWeight: 600 }
                    : isInRange
                      ? { background: 'var(--neon-dim)', color: 'var(--fg)' }
                      : isToday
                        ? { color: 'var(--neon)' }
                        : { color: 'var(--fg)' }
              }
            >
              {day}
            </button>
          )
        })}
      </div>

      {/* Duration toggle */}
      <div className="mt-3 pt-3 border-t border-t-[var(--border)]" >
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => { setShowDuration(!showDuration); if (showDuration) { setStartDateVal(''); setSelectingStart(false) } }}
            className={`text-xs transition-colors ${showDuration ? 'text-[var(--cyan)]' : 'text-[var(--muted)] hover:text-[var(--fg)]'}`}
          >
            {showDuration ? '- Remove duration' : '+ Add duration'}
          </button>
          {showDuration && (
            <button
              type="button"
              onClick={() => setSelectingStart(!selectingStart)}
              className={`text-[10px] px-2 py-0.5 rounded transition-colors ${selectingStart ? 'bg-[var(--cyan)] text-[var(--bg)]' : 'text-[var(--cyan)] hover:bg-[var(--surface)]'}`}
            >
              {selectingStart ? 'Pick start date...' : startDateVal ? `Start: ${startDateVal.slice(5)}` : 'Set start'}
            </button>
          )}
        </div>
      </div>

      {/* Time toggle + picker */}
      <div className="mt-2 pt-2 border-t border-t-[var(--border)]" >
        <button
          type="button"
          onClick={() => setShowTime(!showTime)}
          className={`text-xs transition-colors ${
            showTime ? 'text-[var(--neon)]' : 'text-[var(--muted)] hover:text-[var(--fg)]'
          }`}
        >
          {showTime ? '- Remove time' : '+ Add time'}
        </button>

        {showTime && (
          <div className="flex items-center gap-2 mt-2">
            {/* Hour */}
            <select
              value={selectedHour}
              onChange={(e) => setSelectedHour(e.target.value)}
              className="px-2 py-1.5 rounded-md text-sm font-mono appearance-none cursor-pointer"
              style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--fg)' }}
            >
              <option value="" style={{ color: 'var(--muted)' }}>--</option>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={pad(h)}>{pad(h)}</option>
              ))}
            </select>
            <span className="text-sm font-mono text-[var(--muted)]" >:</span>
            {/* Minute */}
            <select
              value={selectedMinute}
              onChange={(e) => setSelectedMinute(e.target.value)}
              className="px-2 py-1.5 rounded-md text-sm font-mono appearance-none cursor-pointer"
              style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--fg)' }}
            >
              <option value="" style={{ color: 'var(--muted)' }}>--</option>
              {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                <option key={m} value={pad(m)}>{pad(m)}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-t-[var(--border)]" >
        <button
          type="button"
          onClick={handleClear}
          className="text-xs transition-colors text-[var(--muted)]"
          
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--red)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)' }}
        >
          Clear
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-md text-xs transition-colors text-[var(--muted)] border border-[var(--border)]"
            
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!selectedDate}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-opacity disabled:opacity-30 bg-[var(--neon)] text-[var(--bg)]"
            
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
