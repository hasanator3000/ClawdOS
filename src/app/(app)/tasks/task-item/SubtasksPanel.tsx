'use client'

import { useState, useTransition } from 'react'
import type { Task } from '@/lib/db/repositories/task.repository'
import { createTask } from '../actions'

interface SubtasksPanelProps {
  parentId: string
  subtasks: Task[]
  onSubtaskUpdate: (updated: Task) => void
  onSubtaskDelete: (id: string) => void
  onSubtaskCreate: (task: Task) => void
  depth: number
  TaskItemComponent: React.ComponentType<{
    task: Task
    onUpdate: (task: Task) => void
    onDelete: (taskId: string) => void
    depth: number
  }>
}

export function SubtasksPanel({
  parentId, subtasks, onSubtaskUpdate, onSubtaskDelete, onSubtaskCreate, depth, TaskItemComponent,
}: SubtasksPanelProps) {
  const [newSubtask, setNewSubtask] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSubtask.trim()) return
    const title = newSubtask.trim()
    setNewSubtask('')

    startTransition(async () => {
      const result = await createTask({ title, parentId })
      if (result.task) onSubtaskCreate(result.task)
    })
  }

  return (
    <div className="mt-1 space-y-1">
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

      {subtasks.map((sub) => (
        <TaskItemComponent
          key={sub.id}
          task={sub}
          onUpdate={onSubtaskUpdate}
          onDelete={onSubtaskDelete}
          depth={depth + 1}
        />
      ))}
    </div>
  )
}
