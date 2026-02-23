'use client'

import { useState, useTransition, useEffect, memo } from 'react'
import type { Task } from '@/lib/db/repositories/task.repository'
import { normalizeDate, formatTaskDate, getDateColor } from '@/lib/date-utils'
import { getTagColor } from '@/lib/tag-colors'
import { createTask, completeTask, reopenTask, deleteTask, updateTask, updateTaskPriority, fetchSubtasks } from './actions'
import { DateTimePicker } from './DateTimePicker'

const PRIORITY_LABELS: Record<number, string> = {
  0: '', 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Urgent',
}

const PRIORITY_COLORS: Record<number, string> = {
  0: '', 1: 'var(--cyan)', 2: 'var(--warm)', 3: 'var(--pink)', 4: 'var(--red)',
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  todo: { label: 'To Do', color: 'var(--cyan)', bg: 'rgba(0, 188, 212, 0.12)' },
  in_progress: { label: 'In Progress', color: 'var(--warm)', bg: 'rgba(255, 171, 64, 0.12)' },
  done: { label: 'Done', color: 'var(--green)', bg: 'rgba(76, 175, 80, 0.12)' },
  cancelled: { label: 'Cancelled', color: 'var(--muted)', bg: 'rgba(128, 128, 128, 0.12)' },
}

interface TaskItemProps {
  task: Task
  onUpdate: (task: Task) => void
  onDelete: (taskId: string) => void
  depth?: number
  subtaskCount?: number
  onSelect?: (taskId: string) => void
}

export function TaskItem({ task, onUpdate, onDelete, depth = 0, subtaskCount = 0, onSelect }: TaskItemProps) {
  const [isPending, startTransition] = useTransition()
  const [priorityMode, setPriorityMode] = useState(false)
  const [dateMode, setDateMode] = useState(false)
  const [subtasksOpen, setSubtasksOpen] = useState(false)
  const [subtasks, setSubtasks] = useState<Task[]>([])
  const [subtasksLoaded, setSubtasksLoaded] = useState(false)
  const [newSubtask, setNewSubtask] = useState('')

  // Fetch subtasks when panel opens for the first time
  useEffect(() => {
    if (!subtasksOpen || subtasksLoaded) return
    setSubtasksLoaded(true)
    fetchSubtasks(task.id).then((res) => {
      if (res.tasks) setSubtasks(res.tasks)
    })
  }, [subtasksOpen, subtasksLoaded, task.id])

  // Close priority dropdown on click outside
  useEffect(() => {
    if (!priorityMode) return
    const handleClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.priority-dropdown')) setPriorityMode(false)
    }
    const timer = setTimeout(() => document.addEventListener('click', handleClick), 0)
    return () => { clearTimeout(timer); document.removeEventListener('click', handleClick) }
  }, [priorityMode])

  const handleToggleComplete = () => {
    startTransition(async () => {
      const result = task.status === 'done'
        ? await reopenTask(task.id)
        : await completeTask(task.id)
      if (result.task) onUpdate(result.task)
    })
  }

  const handlePriorityChange = (p: number) => {
    const updated = { ...task, priority: p }
    onUpdate(updated)
    setPriorityMode(false)
    startTransition(async () => {
      const result = await updateTaskPriority(task.id, p)
      if (!result.success) onUpdate(task) // rollback
    })
  }

  const handleDateSave = (newDate: string, newTime: string, startDate?: string, startTime?: string) => {
    setDateMode(false)
    const updated = {
      ...task,
      dueDate: newDate || null,
      dueTime: newTime || null,
      startDate: startDate || null,
      startTime: startTime || null,
    }
    onUpdate(updated)
    startTransition(async () => {
      const result = await updateTask(task.id, {
        dueDate: newDate || null,
        dueTime: newTime || null,
        startDate: startDate || null,
        startTime: startTime || null,
      })
      if (result.error) onUpdate(task)
      else if (result.task) onUpdate(result.task)
    })
  }

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteTask(task.id)
      if (result.success) onDelete(task.id)
    })
  }

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSubtask.trim()) return
    const title = newSubtask.trim()
    setNewSubtask('')

    startTransition(async () => {
      const result = await createTask({ title, parentId: task.id })
      if (result.task) {
        setSubtasks((prev) => [result.task!, ...prev])
      }
    })
  }

  const handleSubtaskUpdate = (updated: Task) => {
    setSubtasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
  }

  const handleSubtaskDelete = (id: string) => {
    setSubtasks((prev) => prev.filter((t) => t.id !== id))
  }

  const maxDepth = 2

  return (
    <div style={{ marginLeft: depth > 0 ? 20 : 0 }}>
      <div className="flex items-center gap-3 p-3 bg-[var(--card)] border border-[var(--border)] rounded-lg group hover:border-[var(--neon-dim)] transition-colors">
        {/* Checkbox */}
        <button
          type="button"
          onClick={handleToggleComplete}
          disabled={isPending}
          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
            task.status === 'done'
              ? 'bg-[var(--green)] border-[var(--green)] text-[var(--bg)]'
              : 'border-[var(--border)] hover:border-[var(--neon)]'
          }`}
        >
          {task.status === 'done' && (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* Title + description */}
        <div className="flex-1 min-w-0">
          <div className={`font-medium ${task.status === 'done' ? 'line-through text-[var(--muted)]' : ''}`}>
            {task.title}
          </div>
          {task.description && (
            <div className="text-sm text-[var(--muted)] truncate">{task.description}</div>
          )}
          {task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-0.5">
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

        {/* Status badge */}
        {STATUS_META[task.status] && (
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0"
            style={{ color: STATUS_META[task.status].color, background: STATUS_META[task.status].bg }}
          >
            {STATUS_META[task.status].label}
          </span>
        )}

        {/* Priority badge + editor */}
        <div className="flex items-center gap-1.5 relative">
          {priorityMode ? (
            <div className="priority-dropdown flex gap-1 rounded-lg p-1 shadow-lg" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
              {[0, 1, 2, 3, 4].map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => handlePriorityChange(p)}
                  className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
                    task.priority === p ? 'bg-[var(--neon-dim)]' : 'hover:bg-[var(--surface)]'
                  }`}
                  title={PRIORITY_LABELS[p] || 'None'}
                >
                  {p === 0 ? (
                    <span className="text-xs text-[var(--muted)]">—</span>
                  ) : (
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: PRIORITY_COLORS[p] }} />
                  )}
                </button>
              ))}
            </div>
          ) : task.priority > 0 ? (
            <button type="button" onClick={() => setPriorityMode(true)} className="text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity" style={{ color: PRIORITY_COLORS[task.priority] }}>
              {PRIORITY_LABELS[task.priority]}
            </button>
          ) : (
            <button type="button" onClick={() => setPriorityMode(true)} className="opacity-0 group-hover:opacity-100 p-0.5 transition-opacity" title="Set priority">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="var(--muted)" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h2V3H3zm4 0v12h10l-4-6 4-6H7z" /></svg>
            </button>
          )}
        </div>

        {/* Due date */}
        <div className="relative flex items-center">
          {task.dueDate || task.startDate ? (
            <button type="button" onClick={() => setDateMode(!dateMode)} className="cursor-pointer">
              <DueDate startDate={task.startDate} dueDate={task.dueDate} dueTime={task.dueTime} isDone={task.status === 'done'} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setDateMode(!dateMode)}
              className="p-1 text-[var(--muted)] hover:text-[var(--neon)] transition-colors opacity-0 group-hover:opacity-100"
              title="Set due date"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
          )}
          {dateMode && (
            <DateTimePicker
              date={normalizeDate(task.dueDate)}
              time={task.dueTime || ''}
              startDate={normalizeDate(task.startDate)}
              startTime={task.startTime || ''}
              onSave={handleDateSave}
              onCancel={() => setDateMode(false)}
            />
          )}
        </div>

        {/* Subtask toggle */}
        {depth < maxDepth && (
          <button
            type="button"
            onClick={() => setSubtasksOpen(!subtasksOpen)}
            className={`p-1 flex items-center gap-1 rounded transition-colors ${
              subtasksOpen
                ? 'text-[var(--neon)]'
                : subtaskCount > 0 || subtasks.length > 0
                  ? 'text-[var(--cyan)]'
                  : 'text-[var(--muted)] hover:text-[var(--fg)] opacity-0 group-hover:opacity-100'
            }`}
            title="Subtasks"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h8m-8 6h16" />
            </svg>
            {(subtaskCount > 0 || subtasks.length > 0) && (
              <span className="text-[10px] font-mono font-medium">
                {subtasks.length || subtaskCount}
              </span>
            )}
          </button>
        )}

        {/* Open detail panel */}
        {onSelect && (
          <button type="button" onClick={() => onSelect(task.id)} className="opacity-0 group-hover:opacity-100 p-1 text-[var(--muted)] hover:text-[var(--neon)] transition-colors" aria-label="Open details">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        )}

        {/* Delete */}
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="opacity-0 group-hover:opacity-100 p-1 text-[var(--muted)] hover:text-[var(--red)] transition-colors"
          aria-label="Delete task"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Subtasks panel */}
      {subtasksOpen && depth < maxDepth && (
        <div className="mt-1 space-y-1">
          {/* Add subtask form */}
          <form onSubmit={handleAddSubtask} className="flex gap-2" style={{ marginLeft: 20 }}>
            <input
              type="text"
              value={newSubtask}
              onChange={(e) => setNewSubtask(e.target.value)}
              placeholder="Add subtask..."
              className="flex-1 px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[var(--neon)] transition-colors"
              disabled={isPending}
            />
            <button
              type="submit"
              disabled={!newSubtask.trim() || isPending}
              className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40 transition-opacity text-[var(--neon)] border border-[var(--neon-dim)] hover:bg-[var(--neon-dim)]"
            >
              Add
            </button>
          </form>

          {/* Subtask list */}
          {subtasks.map((sub) => (
            <TaskItem
              key={sub.id}
              task={sub}
              onUpdate={handleSubtaskUpdate}
              onDelete={handleSubtaskDelete}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}


const DueDate = memo(function DueDate({
  startDate, dueDate, dueTime, isDone,
}: {
  startDate: string | null; dueDate: string | null; dueTime: string | null; isDone: boolean
}) {
  const startLabel = startDate ? formatTaskDate(startDate, null) : ''
  const endLabel = dueDate ? formatTaskDate(dueDate, dueTime) : ''

  // Show range if both exist and differ
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
