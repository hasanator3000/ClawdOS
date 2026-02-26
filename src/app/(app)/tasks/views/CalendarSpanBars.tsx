'use client'

import type { Task } from '@/lib/db/repositories/task.repository'
import { normalizeDate, pad } from '@/lib/date-utils'

const PRIORITY_COLORS: Record<number, string> = {
  0: 'var(--neon-dim)', 1: 'var(--cyan)', 2: 'var(--warm)', 3: 'var(--pink)', 4: 'var(--red)',
}

interface CalendarSpanBarsProps {
  tasks: Task[]
  grid: (number | null)[][]
  viewYear: number
  viewMonth: number
  onUpdate: (task: Task) => void
  onDelete: (taskId: string) => void
}

export function CalendarSpanBars({ tasks, grid, viewYear, viewMonth }: CalendarSpanBarsProps) {
  if (tasks.length === 0) return null

  // Build a flat array of date strings matching grid cells
  const cellDates: (string | null)[] = grid.flat().map((day) => {
    if (day === null) return null
    return `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`
  })

  // First/last visible dates
  const firstVisible = cellDates.find((d) => d !== null) || ''
  const lastVisible = [...cellDates].reverse().find((d) => d !== null) || ''

  const bars: Array<{
    task: Task
    rowIdx: number
    startCol: number
    endCol: number
    isStartClipped: boolean
    isEndClipped: boolean
  }> = []

  for (const task of tasks) {
    const startStr = normalizeDate(task.startDate)
    const endStr = normalizeDate(task.dueDate)
    if (!startStr || !endStr) continue

    // Clamp to visible range
    const visStart = startStr < firstVisible ? firstVisible : startStr
    const visEnd = endStr > lastVisible ? lastVisible : endStr
    if (visStart > lastVisible || visEnd < firstVisible) continue

    // Find cell indexes for start and end
    let startIdx = cellDates.indexOf(visStart)
    let endIdx = cellDates.lastIndexOf(visEnd)
    if (startIdx < 0 || endIdx < 0) continue

    // Split across week rows
    const cols = 7
    while (startIdx <= endIdx) {
      const rowIdx = Math.floor(startIdx / cols)
      const rowEnd = (rowIdx + 1) * cols - 1
      const segEnd = Math.min(endIdx, rowEnd)

      bars.push({
        task,
        rowIdx,
        startCol: startIdx % cols,
        endCol: segEnd % cols,
        isStartClipped: startStr < firstVisible && startIdx === cellDates.indexOf(visStart),
        isEndClipped: endStr > lastVisible && segEnd === endIdx,
      })

      startIdx = (rowIdx + 1) * cols // next row
    }
  }

  if (bars.length === 0) return null

  const rowCount = grid.length

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 5 }}>
      {bars.map((bar, i) => {
        const colWidth = 100 / 7
        const left = bar.startCol * colWidth
        const width = (bar.endCol - bar.startCol + 1) * colWidth
        const top = (bar.rowIdx / rowCount) * 100
        const rowHeight = 100 / rowCount
        // Offset down to avoid overlapping day number
        const topPx = `calc(${top}% + ${28 + i * 3}px)`

        return (
          <div
            key={`${bar.task.id}-${bar.rowIdx}-${i}`}
            className="absolute h-[14px] pointer-events-auto cursor-default"
            style={{
              left: `calc(${left}% + 4px)`,
              width: `calc(${width}% - 8px)`,
              top: topPx,
              maxHeight: `calc(${rowHeight}% - 32px)`,
              background: PRIORITY_COLORS[bar.task.priority] || 'var(--neon-dim)',
              opacity: bar.task.status === 'done' ? 0.4 : 0.7,
              borderRadius: `${bar.isStartClipped ? 0 : 6}px ${bar.isEndClipped ? 0 : 6}px ${bar.isEndClipped ? 0 : 6}px ${bar.isStartClipped ? 0 : 6}px`,
            }}
            title={`${bar.task.title} (${normalizeDate(bar.task.startDate)} → ${normalizeDate(bar.task.dueDate)})`}
          >
            <span
              className="block px-1.5 text-[9px] font-medium truncate leading-[14px] text-[var(--bg)]"
              
            >
              {bar.task.title}
            </span>
          </div>
        )
      })}
    </div>
  )
}
