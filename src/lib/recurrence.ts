/**
 * Recurrence logic: compute next occurrence date from a rule.
 */

import type { RecurrenceRule } from '@/lib/db/repositories/task.repository'
import { toDateStr } from './date-utils'

/**
 * Given a base date (the completed task's due date or today) and a rule,
 * compute the next occurrence date as YYYY-MM-DD.
 */
export function computeNextDate(baseDate: string | null, rule: RecurrenceRule): string {
  const base = baseDate ? new Date(baseDate + 'T00:00') : new Date()
  base.setHours(0, 0, 0, 0)

  switch (rule.type) {
    case 'daily': {
      const next = new Date(base)
      next.setDate(next.getDate() + rule.interval)
      return toDateStr(next)
    }
    case 'weekly': {
      const next = new Date(base)
      next.setDate(next.getDate() + 7 * rule.interval)
      return toDateStr(next)
    }
    case 'monthly': {
      const next = new Date(base)
      next.setMonth(next.getMonth() + rule.interval)
      return toDateStr(next)
    }
    case 'custom': {
      // Find next matching weekday
      if (!rule.weekdays || rule.weekdays.length === 0) {
        // Fallback: treat as daily
        const next = new Date(base)
        next.setDate(next.getDate() + 1)
        return toDateStr(next)
      }
      const sorted = [...rule.weekdays].sort((a, b) => a - b)
      const currentDay = base.getDay()
      // Find next weekday after current
      let found: number | null = null
      for (const wd of sorted) {
        if (wd > currentDay) { found = wd; break }
      }
      const next = new Date(base)
      if (found !== null) {
        next.setDate(next.getDate() + (found - currentDay))
      } else {
        // Wrap to first weekday of next week
        next.setDate(next.getDate() + (7 - currentDay + sorted[0]))
      }
      return toDateStr(next)
    }
    default:
      return toDateStr(base)
  }
}

/** Human-readable label for a recurrence rule */
export function recurrenceLabel(rule: RecurrenceRule): string {
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  switch (rule.type) {
    case 'daily':
      return rule.interval === 1 ? 'Daily' : `Every ${rule.interval} days`
    case 'weekly':
      return rule.interval === 1 ? 'Weekly' : `Every ${rule.interval} weeks`
    case 'monthly':
      return rule.interval === 1 ? 'Monthly' : `Every ${rule.interval} months`
    case 'custom':
      if (!rule.weekdays || rule.weekdays.length === 0) return 'Custom'
      return rule.weekdays.map((d) => DAY_NAMES[d]).join(', ')
    default:
      return 'Repeating'
  }
}
