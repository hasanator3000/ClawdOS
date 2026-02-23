/**
 * Shared date utilities for task views.
 * Single source of truth — replaces 6+ duplicated implementations.
 */

export function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

/** Normalize a DB date (ISO "2026-02-22T00:00:00.000Z") to "YYYY-MM-DD" */
export function normalizeDate(raw: string | null): string {
  if (!raw) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const d = new Date(raw)
  if (isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

/** Convert Date to "YYYY-MM-DD" */
export function toDateStr(d: Date): string
/** Convert year/month(0-based)/day parts to "YYYY-MM-DD" */
export function toDateStr(y: number, m: number, d: number): string
export function toDateStr(a: Date | number, m?: number, d?: number): string {
  if (a instanceof Date) {
    return `${a.getFullYear()}-${pad(a.getMonth() + 1)}-${pad(a.getDate())}`
  }
  return `${a}-${pad(m! + 1)}-${pad(d!)}`
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export function getMonday(d: Date): Date {
  const r = new Date(d)
  const day = r.getDay()
  r.setDate(r.getDate() + (day === 0 ? -6 : 1 - day))
  return r
}

/** Build a Monday-start month grid (weeks × 7 cells, null for empty) */
export function getMonthGrid(year: number, month: number): (number | null)[][] {
  const firstDay = new Date(year, month, 1).getDay()
  const startOffset = firstDay === 0 ? 6 : firstDay - 1
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const weeks: (number | null)[][] = []
  let week: (number | null)[] = new Array(startOffset).fill(null)
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d)
    if (week.length === 7) { weeks.push(week); week = [] }
  }
  if (week.length > 0) { while (week.length < 7) week.push(null); weeks.push(week) }
  return weeks
}

/** Format date as "Feb 23" */
export function formatShortDate(raw: string | null): string {
  const dateStr = normalizeDate(raw)
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00')
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Format date + optional time as "Feb 23" or "Feb 23 3:00 PM" */
export function formatTaskDate(dueDate: string | null, dueTime: string | null): string {
  const dateStr = normalizeDate(dueDate)
  if (!dateStr) return ''
  const iso = dueTime ? `${dateStr}T${dueTime}` : `${dateStr}T00:00`
  const date = new Date(iso)
  if (isNaN(date.getTime())) return ''
  const formatted = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (dueTime) {
    const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    return `${formatted} ${time}`
  }
  return formatted
}

/** Color based on urgency: overdue/today=red, <=7d=warm, <=30d=cyan, else muted */
export function getDateColor(dueDate: string | null, isDone: boolean): string {
  if (!dueDate || isDone) return 'var(--muted)'
  const dateStr = normalizeDate(dueDate)
  if (!dateStr) return 'var(--muted)'
  const date = new Date(dateStr + 'T00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  date.setHours(0, 0, 0, 0)
  const daysDiff = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (daysDiff <= 0) return 'var(--red)'
  if (daysDiff <= 7) return 'var(--warm)'
  if (daysDiff <= 30) return 'var(--cyan)'
  return 'var(--muted)'
}
