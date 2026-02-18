'use client'

import { useState, useTransition, useEffect, memo } from 'react'
import type { Task } from '@/lib/db/repositories/task.repository'
import { createTask, completeTask, reopenTask, deleteTask } from './actions'

interface TaskListProps {
  initialTasks: Task[]
}

type FilterStatus = 'all' | 'active' | 'completed'

const PRIORITY_LABELS: Record<number, string> = {
  0: '',
  1: 'Low',
  2: 'Medium',
  3: 'High',
  4: 'Urgent',
}

const PRIORITY_COLORS: Record<number, string> = {
  0: '',
  1: 'text-[var(--cyan)]',
  2: 'text-[var(--warm)]',
  3: 'text-[var(--pink)]',
  4: 'text-[var(--red)]',
}

export function TaskList({ initialTasks }: TaskListProps) {
  const [tasks, setTasks] = useState(initialTasks)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [isPending, startTransition] = useTransition()

  // Sync tasks when initialTasks change (e.g., workspace switch)
  useEffect(() => {
    setTasks(initialTasks)
  }, [initialTasks])

  // Listen for task updates + filter changes from chat AI
  useEffect(() => {
    const handleTaskRefresh = (event: CustomEvent) => {
      const actions = event.detail?.actions || []

      for (const result of actions) {
        if (result.task) {
          if (result.action === 'task.create') {
            // Add new task to the top
            setTasks((prev) => [result.task, ...prev])
          } else if (result.action === 'task.complete' || result.action === 'task.reopen') {
            // Update existing task
            setTasks((prev) => prev.map((t) => (t.id === result.task.id ? result.task : t)))
          }
        }
      }
    }

    const handleFilter = (event: CustomEvent) => {
      const value = event.detail?.value
      if (value === 'active' || value === 'completed' || value === 'all') {
        setFilter(value)
      }
    }

    window.addEventListener('clawdos:task-refresh', handleTaskRefresh as EventListener)
    window.addEventListener('clawdos:tasks-filter', handleFilter as EventListener)
    return () => {
      window.removeEventListener('clawdos:task-refresh', handleTaskRefresh as EventListener)
      window.removeEventListener('clawdos:tasks-filter', handleFilter as EventListener)
    }
  }, [])

  const filteredTasks = tasks.filter((task) => {
    if (filter === 'active') return task.status !== 'done' && task.status !== 'cancelled'
    if (filter === 'completed') return task.status === 'done'
    return true
  })

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTaskTitle.trim()) return

    const title = newTaskTitle.trim()
    setNewTaskTitle('')

    startTransition(async () => {
      const result = await createTask({ title })
      if (result.task) {
        setTasks((prev) => [result.task!, ...prev])
      }
    })
  }

  const handleToggleComplete = (task: Task) => {
    startTransition(async () => {
      if (task.status === 'done') {
        const result = await reopenTask(task.id)
        if (result.task) {
          setTasks((prev) => prev.map((t) => (t.id === task.id ? result.task! : t)))
        }
      } else {
        const result = await completeTask(task.id)
        if (result.task) {
          setTasks((prev) => prev.map((t) => (t.id === task.id ? result.task! : t)))
        }
      }
    })
  }

  const handleDelete = (taskId: string) => {
    startTransition(async () => {
      const result = await deleteTask(taskId)
      if (result.success) {
        setTasks((prev) => prev.filter((t) => t.id !== taskId))
      }
    })
  }

  const activeTasks = tasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled')
  const completedTasks = tasks.filter((t) => t.status === 'done')

  return (
    <div className="space-y-6">
      {/* New task form */}
      <form onSubmit={handleCreateTask} className="flex gap-2">
        <input
          type="text"
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          placeholder="Add a new task..."
          className="flex-1 px-4 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--neon)] focus:shadow-[0_0_0_1px_var(--neon-dim)] transition-colors"
          disabled={isPending}
        />
        <button
          type="submit"
          disabled={!newTaskTitle.trim() || isPending}
          className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-opacity hover:opacity-90"
          style={{
            background: 'linear-gradient(135deg, var(--neon), var(--pink))',
            color: 'var(--bg)',
          }}
        >
          Add
        </button>
      </form>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-[var(--border)]">
        <button
          type="button"
          onClick={() => setFilter('active')}
          className={`px-4 py-2 -mb-px border-b-2 transition-colors text-sm ${
            filter === 'active'
              ? 'border-[var(--neon)] text-[var(--neon)]'
              : 'border-transparent text-[var(--muted)] hover:text-[var(--fg)]'
          }`}
        >
          Active ({activeTasks.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('completed')}
          className={`px-4 py-2 -mb-px border-b-2 transition-colors text-sm ${
            filter === 'completed'
              ? 'border-[var(--neon)] text-[var(--neon)]'
              : 'border-transparent text-[var(--muted)] hover:text-[var(--fg)]'
          }`}
        >
          Completed ({completedTasks.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`px-4 py-2 -mb-px border-b-2 transition-colors text-sm ${
            filter === 'all'
              ? 'border-[var(--neon)] text-[var(--neon)]'
              : 'border-transparent text-[var(--muted)] hover:text-[var(--fg)]'
          }`}
        >
          All ({tasks.length})
        </button>
      </div>

      {/* Task list */}
      <div className="space-y-2">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-8 text-[var(--muted)]">
            {filter === 'active' ? 'No active tasks' : filter === 'completed' ? 'No completed tasks' : 'No tasks yet'}
          </div>
        ) : (
          filteredTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-3 p-3 bg-[var(--card)] border border-[var(--border)] rounded-lg group hover:border-[var(--neon-dim)] transition-colors"
            >
              {/* Checkbox */}
              <button
                type="button"
                onClick={() => handleToggleComplete(task)}
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

              {/* Title and description */}
              <div className="flex-1 min-w-0">
                <div
                  className={`font-medium ${task.status === 'done' ? 'line-through text-[var(--muted)]' : ''}`}
                >
                  {task.title}
                </div>
                {task.description && (
                  <div className="text-sm text-[var(--muted)] truncate">{task.description}</div>
                )}
              </div>

              {/* Priority badge */}
              {task.priority > 0 && (
                <span className={`text-xs font-medium ${PRIORITY_COLORS[task.priority]}`}>
                  {PRIORITY_LABELS[task.priority]}
                </span>
              )}

              {/* Due date */}
              {task.dueDate && <DueDate dueDate={task.dueDate} isDone={task.status === 'done'} />}

              {/* Delete button */}
              <button
                type="button"
                onClick={() => handleDelete(task.id)}
                disabled={isPending}
                className="opacity-0 group-hover:opacity-100 p-1 text-[var(--muted)] hover:text-[var(--red)] transition-colors"
                aria-label="Delete task"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// Memoized to avoid creating Date objects for every task on every render
const DueDate = memo(function DueDate({ dueDate, isDone }: { dueDate: string; isDone: boolean }) {
  const d = new Date(dueDate)
  const overdue = d < new Date() && !isDone
  return (
    <span className={`text-xs ${overdue ? 'text-[var(--red)]' : 'text-[var(--muted)]'}`}>
      {d.toLocaleDateString()}
    </span>
  )
})
