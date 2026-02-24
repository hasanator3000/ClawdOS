'use client'

import { memo } from 'react'
import { normalizeDate, formatTaskDate, getDateColor } from '@/lib/date-utils'

export const DueDate = memo(function DueDate({
  startDate, dueDate, dueTime, isDone,
}: {
  startDate: string | null; dueDate: string | null; dueTime: string | null; isDone: boolean
}) {
  const startLabel = startDate ? formatTaskDate(startDate, null) : ''
  const endLabel = dueDate ? formatTaskDate(dueDate, dueTime) : ''

  if (startLabel && endLabel && normalizeDate(startDate) !== normalizeDate(dueDate)) {
    return (
      <span className="text-xs" style={{ color: getDateColor(dueDate, isDone) }}>
        {startLabel} - {endLabel}
      </span>
    )
  }

  return (
    <span className="text-xs" style={{ color: getDateColor(dueDate || startDate, isDone) }}>
      {endLabel || startLabel}
    </span>
  )
})
