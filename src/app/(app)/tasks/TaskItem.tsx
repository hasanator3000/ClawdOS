'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import type { Task } from '@/lib/db/repositories/task.repository'
import { normalizeDate } from '@/lib/date-utils'
import { getTagColor } from '@/lib/tag-colors'
import { recurrenceLabel } from '@/lib/recurrence'
import { completeTask, reopenTask, deleteTask, updateTask, updateTaskPriority, fetchSubtasks } from './actions'
import { DateTimePicker } from './DateTimePicker'
import { PRIORITY_COLORS, STATUS_META } from './task-item/constants'
import { DueDate } from './task-item/DueDate'
import { PriorityEditor } from './task-item/PriorityEditor'
import { SubtasksPanel } from './task-item/SubtasksPanel'

interface TaskItemProps {
  task: Task
  onUpdate: (task: Task) => void
  onDelete: (taskId: string) => void
  depth?: number
  subtaskCount?: number
  onSelect?: (taskId: string) => void
  projectName?: string
}

export function TaskItem({ task, onUpdate, onDelete, depth = 0, subtaskCount = 0, onSelect, projectName }: TaskItemProps) {
  const [isPending, startTransition] = useTransition()
  const [dateMode, setDateMode] = useState(false)
  const [subtasksOpen, setSubtasksOpen] = useState(false)
  const [subtasks, setSubtasks] = useState<Task[]>([])
  const subtasksLoadedRef = useRef(false)

  useEffect(() => {
    if (!subtasksOpen || subtasksLoadedRef.current) return
    subtasksLoadedRef.current = true
    fetchSubtasks(task.id).then((res) => {
      if (res.tasks) setSubtasks(res.tasks)
    })
  }, [subtasksOpen, task.id])

  const handleToggleComplete = () => {
    // Optimistic: toggle status immediately
    const optimistic = {
      ...task,
      status: task.status === 'done' ? 'todo' as const : 'done' as const,
      completedAt: task.status === 'done' ? null : new Date(),
    }
    onUpdate(optimistic)
    startTransition(async () => {
      const result = task.status === 'done'
        ? await reopenTask(task.id)
        : await completeTask(task.id)
      if (result.task) onUpdate(result.task)
      else onUpdate(task) // revert on error
      if ('nextTask' in result && result.nextTask) {
        window.dispatchEvent(new CustomEvent('clawdos:task-refresh', {
          detail: { actions: [{ action: 'task.create', task: result.nextTask }] },
        }))
      }
    })
  }

  const handlePriorityChange = (p: number) => {
    const updated = { ...task, priority: p }
    onUpdate(updated)
    startTransition(async () => {
      const result = await updateTaskPriority(task.id, p)
      if (!result.success) onUpdate(task)
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
    // Optimistic: remove immediately
    onDelete(task.id)
    startTransition(async () => {
      const result = await deleteTask(task.id)
      if (result.error) {
        // Rollback: re-add task on failure
        onUpdate(task)
      }
    })
  }

  const maxDepth = 2

  return (
    <div style={{ marginLeft: depth > 0 ? 20 : 0 }}>
      <div
        className="flex items-center gap-4 px-4 py-3.5 bg-[var(--card)] border border-[var(--border)] rounded-xl group hover:border-[var(--neon-dim)] transition-colors"
        style={task.priority > 0 ? { borderLeftWidth: '3px', borderLeftColor: PRIORITY_COLORS[task.priority] } : undefined}
      >
        {/* Checkbox */}
        <button
          type="button"
          onClick={handleToggleComplete}
          disabled={isPending}
          className={`w-[22px] h-[22px] rounded-md border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
            task.status === 'done'
              ? 'bg-[var(--green)] border-[var(--green)] text-[var(--bg)]'
              : 'border-[var(--border)] hover:border-[var(--neon)]'
          }`}
        >
          {task.status === 'done' && (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* Title + description */}
        <div className="flex-1 min-w-0">
          <div className={`text-[15px] font-medium leading-snug ${task.status === 'done' ? 'line-through text-[var(--muted)]' : ''}`}>
            {task.title}
          </div>
          {(task.description || projectName) && (
            <div className="flex items-center gap-2 text-sm text-[var(--muted)] truncate mt-0.5">
              {projectName && <span className="text-[11px] font-medium text-[var(--cyan)]" >{projectName}</span>}
              {task.description && <span className="truncate">{task.description}</span>}
            </div>
          )}
          {task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {task.tags.map((tag) => {
                const tc = getTagColor(tag)
                return (
                  <span key={tag} className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ color: tc.color, background: tc.bg }}>
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
            className="text-[11px] font-medium px-2 py-1 rounded-md flex-shrink-0"
            style={{ color: STATUS_META[task.status].color, background: STATUS_META[task.status].bg }}
          >
            {STATUS_META[task.status].label}
          </span>
        )}

        {/* Recurrence indicator */}
        {task.recurrenceRule && (
          <span
            className="text-[11px] font-medium px-2 py-1 rounded-md flex-shrink-0 flex items-center gap-1"
            style={{ color: 'var(--cyan)', background: 'rgba(0, 188, 212, 0.12)' }}
            title={recurrenceLabel(task.recurrenceRule)}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {recurrenceLabel(task.recurrenceRule)}
          </span>
        )}

        {/* Priority badge + editor */}
        <div className="flex items-center gap-1.5 relative">
          <PriorityEditor priority={task.priority} onPriorityChange={handlePriorityChange} />
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
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            className={`p-1.5 flex items-center gap-1 rounded-md transition-colors ${
              subtasksOpen
                ? 'text-[var(--neon)]'
                : subtaskCount > 0 || subtasks.length > 0
                  ? 'text-[var(--cyan)]'
                  : 'text-[var(--muted)] hover:text-[var(--fg)] opacity-0 group-hover:opacity-100'
            }`}
            title="Subtasks"
          >
            <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h8m-8 6h16" />
            </svg>
            {(subtaskCount > 0 || subtasks.length > 0) && (
              <span className="text-[11px] font-mono font-medium">
                {subtasks.length || subtaskCount}
              </span>
            )}
          </button>
        )}

        {/* Open detail panel */}
        {onSelect && (
          <button type="button" onClick={() => onSelect(task.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-[var(--muted)] hover:text-[var(--neon)] transition-colors" aria-label="Open details">
            <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        )}

        {/* Delete */}
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="opacity-0 group-hover:opacity-100 p-1.5 text-[var(--muted)] hover:text-[var(--red)] transition-colors"
          aria-label="Delete task"
        >
          <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Subtasks panel */}
      {subtasksOpen && depth < maxDepth && (
        <SubtasksPanel
          parentId={task.id}
          subtasks={subtasks}
          onSubtaskUpdate={(updated) => setSubtasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))}
          onSubtaskDelete={(id) => setSubtasks((prev) => prev.filter((t) => t.id !== id))}
          onSubtaskCreate={(t) => setSubtasks((prev) => [t, ...prev])}
          depth={depth}
          TaskItemComponent={TaskItem}
        />
      )}
    </div>
  )
}
