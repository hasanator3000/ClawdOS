/**
 * Natural-language date parser — Russian + English
 * Zero dependencies, pure functions.
 */

import { toDateStr } from './date-utils'

export interface ParsedDate {
  /** Resolved YYYY-MM-DD */
  dateStr: string
  /** The matched phrase in the original text */
  phrase: string
  /** Title with the date phrase stripped */
  remaining: string
  /** Human-readable label for preview */
  label: string
}

// Weekday names → JS getDay() (0=Sun … 6=Sat)
const WEEKDAYS_RU: Record<string, number> = {
  'понедельник': 1, 'вторник': 2, 'среда': 3, 'четверг': 4,
  'пятница': 5, 'суббота': 6, 'воскресенье': 0,
  // short forms
  'пн': 1, 'вт': 2, 'ср': 3, 'чт': 4, 'пт': 5, 'сб': 6, 'вс': 0,
}

const WEEKDAYS_EN: Record<string, number> = {
  'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4,
  'friday': 5, 'saturday': 6, 'sunday': 0,
  'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6, 'sun': 0,
}

const WEEKDAY_LABELS: Record<number, string> = {
  0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday',
  4: 'Thursday', 5: 'Friday', 6: 'Saturday',
}

type Rule = {
  pattern: RegExp
  resolve: (match: RegExpMatchArray, now: Date) => { date: Date; label: string } | null
}

function addDaysTo(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function nextWeekday(now: Date, target: number): Date {
  const current = now.getDay()
  let diff = target - current
  if (diff <= 0) diff += 7
  return addDaysTo(now, diff)
}

const rules: Rule[] = [
  // === Russian ===
  { pattern: /\bсегодня\b/i, resolve: (_m, now) => ({ date: now, label: 'Today' }) },
  { pattern: /\bзавтра\b/i, resolve: (_m, now) => ({ date: addDaysTo(now, 1), label: 'Tomorrow' }) },
  { pattern: /\bпослезавтра\b/i, resolve: (_m, now) => ({ date: addDaysTo(now, 2), label: 'Day after tomorrow' }) },
  // "через N дней/дня/день"
  {
    pattern: /\bчерез\s+(\d+)\s+(?:дней|дня|день)\b/i,
    resolve: (m, now) => {
      const n = parseInt(m[1], 10)
      if (n < 1 || n > 365) return null
      return { date: addDaysTo(now, n), label: `In ${n} day${n === 1 ? '' : 's'}` }
    },
  },
  // "через N недель/недели/неделю"
  {
    pattern: /\bчерез\s+(\d+)\s+(?:недель|недели|неделю)\b/i,
    resolve: (m, now) => {
      const n = parseInt(m[1], 10)
      if (n < 1 || n > 52) return null
      return { date: addDaysTo(now, n * 7), label: `In ${n} week${n === 1 ? '' : 's'}` }
    },
  },
  // "через неделю"
  { pattern: /\bчерез\s+неделю\b/i, resolve: (_m, now) => ({ date: addDaysTo(now, 7), label: 'In 1 week' }) },
  // "через месяц"
  {
    pattern: /\bчерез\s+месяц\b/i,
    resolve: (_m, now) => {
      const d = new Date(now)
      d.setMonth(d.getMonth() + 1)
      return { date: d, label: 'In 1 month' }
    },
  },
  // Russian weekday names
  ...Object.entries(WEEKDAYS_RU).map(([name, dayNum]): Rule => ({
    pattern: new RegExp(`\\b${name}\\b`, 'i'),
    resolve: (_m, now) => ({ date: nextWeekday(now, dayNum), label: WEEKDAY_LABELS[dayNum] }),
  })),

  // === English ===
  { pattern: /\btoday\b/i, resolve: (_m, now) => ({ date: now, label: 'Today' }) },
  { pattern: /\btomorrow\b/i, resolve: (_m, now) => ({ date: addDaysTo(now, 1), label: 'Tomorrow' }) },
  { pattern: /\bday after tomorrow\b/i, resolve: (_m, now) => ({ date: addDaysTo(now, 2), label: 'Day after tomorrow' }) },
  // "in N days"
  {
    pattern: /\bin\s+(\d+)\s+days?\b/i,
    resolve: (m, now) => {
      const n = parseInt(m[1], 10)
      if (n < 1 || n > 365) return null
      return { date: addDaysTo(now, n), label: `In ${n} day${n === 1 ? '' : 's'}` }
    },
  },
  // "in N weeks"
  {
    pattern: /\bin\s+(\d+)\s+weeks?\b/i,
    resolve: (m, now) => {
      const n = parseInt(m[1], 10)
      if (n < 1 || n > 52) return null
      return { date: addDaysTo(now, n * 7), label: `In ${n} week${n === 1 ? '' : 's'}` }
    },
  },
  // "in a week" / "next week"
  { pattern: /\b(?:in a week|next week)\b/i, resolve: (_m, now) => ({ date: addDaysTo(now, 7), label: 'In 1 week' }) },
  // "in a month" / "next month"
  {
    pattern: /\b(?:in a month|next month)\b/i,
    resolve: (_m, now) => {
      const d = new Date(now)
      d.setMonth(d.getMonth() + 1)
      return { date: d, label: 'In 1 month' }
    },
  },
  // English weekday names
  ...Object.entries(WEEKDAYS_EN).map(([name, dayNum]): Rule => ({
    pattern: new RegExp(`\\b${name}\\b`, 'i'),
    resolve: (_m, now) => ({ date: nextWeekday(now, dayNum), label: WEEKDAY_LABELS[dayNum] }),
  })),
]

/**
 * Parse natural-language date from task title text.
 * Returns the first match found, or null.
 */
export function parseNaturalDate(text: string, now?: Date): ParsedDate | null {
  const ref = now ?? new Date()
  ref.setHours(0, 0, 0, 0)

  for (const rule of rules) {
    const match = text.match(rule.pattern)
    if (!match) continue

    const result = rule.resolve(match, ref)
    if (!result) continue

    const phrase = match[0]
    // Strip phrase from title, clean up extra whitespace
    const remaining = text.replace(phrase, '').replace(/\s{2,}/g, ' ').trim()
    const dateStr = toDateStr(result.date)

    // Format label with actual date
    const formatted = result.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const label = `${result.label} (${formatted})`

    return { dateStr, phrase, remaining, label }
  }

  return null
}
