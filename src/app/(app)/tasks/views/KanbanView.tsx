'use client'

import { useState } from 'react'
import { DndContext, useDroppable, useDraggable, closestCenter, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import type { Task } from '@/lib/db/repositories/task.repository'
import { TaskCard } from '../TaskCard'
import { useDndSensors } from '../dnd/use-dnd-sensors'
import { TaskDragOverlay } from '../dnd/TaskDragOverlay'
import { updateTaskDate } from '../actions'

const COLUMNS: Array<{
  id: Task['status']
  label: string
  color: string
}> = [
  { id: 'todo', label: 'To Do', color: 'var(--cyan)' },
  { id: 'in_progress', label: 'In Progress', color: 'var(--warm)' },
  { id: 'done', label: 'Done', color: 'var(--green)' },
  { id: 'cancelled', label: 'Cancelled', color: 'var(--muted)' },
]

interface KanbanViewProps {
  tasks: Task[]
  onUpdate: (task: Task) => void
  onDelete: (taskId: string) => void
  subtaskCounts: Map<string, number>
  onSelectTask?: (taskId: string) => void
  projectMap?: Map<string, string>
}

export function KanbanView({ tasks, onUpdate, onDelete, onSelectTask, projectMap }: KanbanViewProps) {
  const sensors = useDndSensors()
  const [activeTask, setActiveTask] = useState<Task | null>(null)

  const sorted = [...tasks].sort((a, b) => (b.priority || 0) - (a.priority || 0))

  const handleDragStart = (event: DragStartEvent) => {
    const task = event.active.data.current?.task as Task | undefined
    setActiveTask(task || null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null)
    const { active, over } = event
    if (!over) return

    const task = active.data.current?.task as Task
    if (!task) return

    // The over target is a column droppable
    const targetStatus = (over.data.current?.columnId || over.id) as Task['status']
    if (task.status === targetStatus) return

    // Optimistic update
    const updated = { ...task, status: targetStatus }
    onUpdate(updated)

    updateTaskDate(task.id, { status: targetStatus }).then((res) => {
      if (res.error) onUpdate(task) // rollback
      else if (res.task) onUpdate(res.task)
    })
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4 -mx-2 px-2">
        {COLUMNS.map((col) => {
          const colTasks = sorted.filter((t) => t.status === col.id)
          return (
            <KanbanColumn
              key={col.id}
              column={col}
              tasks={colTasks}
              onUpdate={onUpdate}
              onDelete={onDelete}
              isDragging={!!activeTask}
              onSelectTask={onSelectTask}
              projectMap={projectMap}
            />
          )
        })}
      </div>
      <TaskDragOverlay activeTask={activeTask} />
    </DndContext>
  )
}

// Droppable column
function KanbanColumn({
  column,
  tasks,
  onUpdate,
  onDelete,
  isDragging,
  onSelectTask,
  projectMap,
}: {
  column: { id: Task['status']; label: string; color: string }
  tasks: Task[]
  onUpdate: (task: Task) => void
  onDelete: (taskId: string) => void
  isDragging: boolean
  onSelectTask?: (taskId: string) => void
  projectMap?: Map<string, string>
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { columnId: column.id },
  })

  return (
    <div
      ref={setNodeRef}
      className="flex-shrink-0 w-[260px] rounded-xl transition-all"
      style={{
        background: 'var(--card)',
        border: isOver ? `2px solid ${column.color}` : '1px solid var(--border)',
        boxShadow: isOver ? `0 0 16px ${column.color}40` : undefined,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2.5 rounded-t-xl"
        style={{ borderBottom: `2px solid ${column.color}` }}
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: column.color }} />
          <span className="text-sm font-medium text-[var(--fg)]" >{column.label}</span>
        </div>
        <span className="text-xs font-mono px-1.5 py-0.5 rounded-md bg-[var(--surface)] text-[var(--muted)]" >
          {tasks.length}
        </span>
      </div>

      {/* Cards */}
      <div className="p-2 space-y-2 max-h-[60vh] overflow-y-auto">
        {tasks.length === 0 ? (
          <div
            className="text-center py-6 text-xs rounded-lg transition-colors"
            style={{
              color: isDragging && isOver ? column.color : 'var(--muted)',
              border: `1px dashed ${isDragging && isOver ? column.color : 'var(--border)'}`,
            }}
          >
            {isDragging ? 'Drop here' : 'No tasks'}
          </div>
        ) : (
          tasks.map((task) => (
            <DraggableCard key={task.id} task={task} onUpdate={onUpdate} onDelete={onDelete} onSelectTask={onSelectTask} projectName={task.projectId ? projectMap?.get(task.projectId) : undefined} />
          ))
        )}
      </div>
    </div>
  )
}

// Draggable card wrapper
function DraggableCard({
  task,
  onUpdate,
  onDelete,
  onSelectTask,
  projectName,
}: {
  task: Task
  onUpdate: (task: Task) => void
  onDelete: (taskId: string) => void
  onSelectTask?: (taskId: string) => void
  projectName?: string
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ opacity: isDragging ? 0.3 : 1, cursor: 'grab' }}
    >
      <TaskCard task={task} onUpdate={onUpdate} onDelete={onDelete} showStatus onSelect={onSelectTask} projectName={projectName} />
    </div>
  )
}
