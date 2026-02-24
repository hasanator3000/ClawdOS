'use client'

import { DragOverlay } from '@dnd-kit/core'
import type { Task } from '@/lib/db/repositories/task.repository'
import { TaskCard } from '../TaskCard'

interface TaskDragOverlayProps {
  activeTask: Task | null
  compact?: boolean
}

export function TaskDragOverlay({ activeTask, compact = false }: TaskDragOverlayProps) {
  return (
    <DragOverlay dropAnimation={null}>
      {activeTask && (
        <div style={{ opacity: 0.85, transform: 'rotate(2deg)', pointerEvents: 'none' }}>
          <TaskCard
            task={activeTask}
            onUpdate={() => {}}
            onDelete={() => {}}
            compact={compact}
          />
        </div>
      )}
    </DragOverlay>
  )
}
