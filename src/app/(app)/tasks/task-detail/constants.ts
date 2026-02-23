import type { Task, RecurrenceRule } from '@/lib/db/repositories/task.repository'

export const STATUS_OPTIONS: Array<{ value: Task['status']; label: string; color: string; bg: string }> = [
  { value: 'todo', label: 'To Do', color: 'var(--cyan)', bg: 'rgba(0, 188, 212, 0.12)' },
  { value: 'in_progress', label: 'In Progress', color: 'var(--warm)', bg: 'rgba(255, 171, 64, 0.12)' },
  { value: 'done', label: 'Done', color: 'var(--green)', bg: 'rgba(76, 175, 80, 0.12)' },
  { value: 'cancelled', label: 'Cancelled', color: 'var(--muted)', bg: 'rgba(128, 128, 128, 0.12)' },
]

export const PRIORITY_OPTIONS = [
  { value: 0, label: 'None', color: '' },
  { value: 1, label: 'Low', color: 'var(--cyan)' },
  { value: 2, label: 'Medium', color: 'var(--warm)' },
  { value: 3, label: 'High', color: 'var(--pink)' },
  { value: 4, label: 'Urgent', color: 'var(--red)' },
]

export const RECURRENCE_PRESETS: Array<{ label: string; rule: RecurrenceRule }> = [
  { label: 'Daily', rule: { type: 'daily', interval: 1 } },
  { label: 'Weekly', rule: { type: 'weekly', interval: 1 } },
  { label: 'Bi-weekly', rule: { type: 'weekly', interval: 2 } },
  { label: 'Monthly', rule: { type: 'monthly', interval: 1 } },
]

export const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
