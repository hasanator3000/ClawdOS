'use client'

import { memo, useTransition } from 'react'
import type { Task } from '@/lib/db/repositories/task.repository'
import { normalizeDate, formatShortDate, getDateColor } from '@/lib/date-utils'
import { getTagColor } from '@/lib/tag-colors'
import { completeTask, reopenTask } from './actions'

const PRIORITY_COLORS: Record<number, string> = {
  0: '', 1: 'var(--cyan)', 2: 'var(--warm)', 3: 'var(--pink)', 4: 'var(--red)',
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  todo: { label: 'To Do', color: 'var(--cyan)', bg: 'rgba(0, 188, 212, 0.12)' },
  in_progress: { label: 'In Progress', color: 'var(--warm)', bg: 'rgba(255, 171, 64, 0.12)' },
  done: { label: 'Done', color: 'var(--green)', bg: 'rgba(76, 175, 80, 0.12)' },
  cancelled: { label: 'Cancelled', color: 'var(--muted)', bg: 'rgba(128, 128, 128, 0.12)' },
}

interface TaskCardProps {
  task: Task
  onUpdate: (task: Task) => void
  onDelete: (taskId: string) => void
  compact?: boolean
  showStatus?: boolean
  onSelect?: (taskId: string) => void
}

export const TaskCard = memo(function TaskCard({ task, onUpdate, onDelete, compact = false, showStatus = false, onSelect }: TaskCardProps) {
  const [isPending, startTransition] = useTransition()
  const isDone = task.status === 'done'

  const handleToggle = () => {
    startTransition(async () => {
      const result = isDone ? await reopenTask(task.id) : await completeTask(task.id)
      if (result.task) onUpdate(result.task)
    })
  }

  const startLabel = task.startDate ? formatShortDate(task.startDate) : null
  const endLabel = task.dueDate ? formatShortDate(task.dueDate) : null
  const dateLabel = startLabel && endLabel && startLabel !== endLabel
    ? `${startLabel} - ${endLabel}`
    : endLabel || startLabel

  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    onSelect?.(task.id)
  }

  if (compact) {
    return (
      <div
        onClick={handleCardClick}
        className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[11px] truncate group/card ${onSelect ? 'cursor-pointer' : 'cursor-default'}`}
        style={{
          background: isDone ? 'transparent' : 'var(--surface)',
          borderLeft: task.priority > 0 ? `2px solid ${PRIORITY_COLORS[task.priority]}` : '2px solid transparent',
          opacity: isDone ? 0.5 : 1,
        }}
        title={task.title}
      >
        <button
          type="button"
          onClick={handleToggle}
          disabled={isPending}
          className="flex-shrink-0 w-3 h-3 rounded-sm border flex items-center justify-center transition-colors"
          style={{
            borderColor: isDone ? 'var(--green)' : 'var(--border)',
            background: isDone ? 'var(--green)' : 'transparent',
          }}
        >
          {isDone && (
            <svg className="w-2 h-2" fill="none" viewBox="0 0 24 24" stroke="var(--bg)">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
        <span className={`truncate ${isDone ? 'line-through text-[var(--muted)]' : ''}`} style={{ color: isDone ? undefined : 'var(--fg)' }}>
          {task.title}
        </span>
        {showStatus && STATUS_META[task.status] && (
          <span
            className="flex-shrink-0 ml-auto text-[9px] font-medium px-1 rounded"
            style={{ color: STATUS_META[task.status].color, background: STATUS_META[task.status].bg }}
          >
            {STATUS_META[task.status].label}
          </span>
        )}
      </div>
    )
  }

  return (
    <div
      onClick={handleCardClick}
      className={`p-2.5 rounded-lg group/card transition-colors ${onSelect ? 'cursor-pointer' : ''}`}
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderLeft: task.priority > 0 ? `3px solid ${PRIORITY_COLORS[task.priority]}` : undefined,
      }}
    >
      <div className="flex items-start gap-2">
        {/* Checkbox */}
        <button
          type="button"
          onClick={handleToggle}
          disabled={isPending}
          className="flex-shrink-0 w-4 h-4 mt-0.5 rounded border flex items-center justify-center transition-colors"
          style={{
            borderColor: isDone ? 'var(--green)' : 'var(--border)',
            background: isDone ? 'var(--green)' : 'transparent',
          }}
        >
          {isDone && (
            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="var(--bg)">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div
            className={`text-sm leading-tight truncate ${isDone ? 'line-through' : ''}`}
            style={{ color: isDone ? 'var(--muted)' : 'var(--fg)' }}
          >
            {task.title}
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-2 mt-1">
            {showStatus && STATUS_META[task.status] && (
              <span
                className="text-[10px] font-medium px-1.5 py-px rounded"
                style={{ color: STATUS_META[task.status].color, background: STATUS_META[task.status].bg }}
              >
                {STATUS_META[task.status].label}
              </span>
            )}
            {dateLabel && (
              <span className="text-[10px]" style={{ color: getDateColor(task.dueDate, isDone) }}>
                {dateLabel}
              </span>
            )}
            {task.dueTime && (
              <span className="text-[10px]" style={{ color: 'var(--muted)' }}>
                {task.dueTime}
              </span>
            )}
          </div>
          {task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {task.tags.map((tag) => {
                const tc = getTagColor(tag)
                return (
                  <span key={tag} className="text-[9px] font-medium px-1.5 py-px rounded-full" style={{ color: tc.color, background: tc.bg }}>
                    {tag}
                  </span>
                )
              })}
            </div>
          )}
        </div>

        {/* Delete (hover only) */}
        <button
          type="button"
          onClick={() => onDelete(task.id)}
          className="opacity-0 group-hover/card:opacity-100 p-0.5 text-[var(--muted)] hover:text-[var(--red)] transition-all"
          aria-label="Delete"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
})

