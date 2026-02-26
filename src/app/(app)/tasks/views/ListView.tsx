'use client'

import type { Task } from '@/lib/db/repositories/task.repository'
import { TaskItem } from '../TaskItem'

interface ListViewProps {
  tasks: Task[]
  onUpdate: (task: Task) => void
  onDelete: (taskId: string) => void
  subtaskCounts: Map<string, number>
  onSelectTask?: (taskId: string) => void
  projectMap?: Map<string, string>
}

export function ListView({ tasks, onUpdate, onDelete, subtaskCounts, onSelectTask, projectMap }: ListViewProps) {
  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 text-[var(--muted)]">
        No tasks match current filters
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          onUpdate={onUpdate}
          onDelete={onDelete}
          subtaskCount={subtaskCounts.get(task.id) || 0}
          onSelect={onSelectTask}
          projectName={task.projectId ? projectMap?.get(task.projectId) : undefined}
        />
      ))}
    </div>
  )
}
