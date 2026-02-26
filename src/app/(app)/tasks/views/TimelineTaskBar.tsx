'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { useDraggable } from '@dnd-kit/core'
import type { Task } from '@/lib/db/repositories/task.repository'
import { normalizeDate, toDateStr, addDays } from '@/lib/date-utils'

const PRIORITY_COLORS: Record<number, string> = {
  0: 'var(--neon-dim)', 1: 'var(--cyan)', 2: 'var(--warm)', 3: 'var(--pink)', 4: 'var(--red)',
}

interface TimelineTaskBarProps {
  task: Task
  dayWidth: number
  startIdx: number
  spanDays: number
  onUpdate: (task: Task) => void
  onResize: (taskId: string, startDate: string | null, dueDate: string | null) => void
  onSelect?: (taskId: string) => void
}

export function TimelineTaskBar({ task, dayWidth, startIdx, spanDays, onUpdate, onResize, onSelect }: TimelineTaskBarProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  })

  const isDone = task.status === 'done'
  const color = PRIORITY_COLORS[task.priority] || 'var(--neon-dim)'
  const hasDuration = spanDays > 1

  // Resize state
  const [resizeDelta, setResizeDelta] = useState(0)
  const [resizeSide, setResizeSide] = useState<'left' | 'right' | null>(null)
  const resizeStartX = useRef(0)

  const handleResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent, side: 'left' | 'right') => {
    e.stopPropagation()
    e.preventDefault()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    resizeStartX.current = clientX
    setResizeSide(side)
    setResizeDelta(0)
  }, [])

  useEffect(() => {
    if (!resizeSide) return

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      setResizeDelta(clientX - resizeStartX.current)
    }

    const handleEnd = () => {
      const daysMoved = Math.round(resizeDelta / dayWidth)
      if (daysMoved !== 0) {
        const startStr = normalizeDate(task.startDate)
        const dueStr = normalizeDate(task.dueDate)

        if (resizeSide === 'left' && startStr) {
          const newStart = addDays(new Date(startStr + 'T00:00'), daysMoved)
          onResize(task.id, toDateStr(newStart), dueStr || null)
        } else if (resizeSide === 'right' && dueStr) {
          const newDue = addDays(new Date(dueStr + 'T00:00'), daysMoved)
          onResize(task.id, startStr || null, toDateStr(newDue))
        }
      }

      setResizeSide(null)
      setResizeDelta(0)
    }

    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleEnd)
    document.addEventListener('touchmove', handleMove)
    document.addEventListener('touchend', handleEnd)
    return () => {
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleEnd)
      document.removeEventListener('touchmove', handleMove)
      document.removeEventListener('touchend', handleEnd)
    }
  }, [resizeSide, resizeDelta, dayWidth, task, onResize])

  // Compute visual width/offset with resize delta
  let visualLeft = startIdx * dayWidth + 2
  let visualWidth = spanDays * dayWidth - 4
  if (resizeSide === 'left') {
    visualLeft += resizeDelta
    visualWidth -= resizeDelta
  } else if (resizeSide === 'right') {
    visualWidth += resizeDelta
  }
  visualWidth = Math.max(visualWidth, dayWidth * 0.5)

  return (
    <div
      ref={setNodeRef}
      className="relative group/bar rounded-md transition-shadow"
      style={{
        position: 'absolute',
        left: visualLeft,
        width: visualWidth,
        height: 28,
        background: color,
        opacity: isDragging ? 0.3 : isDone ? 0.5 : 0.85,
        cursor: resizeSide ? 'col-resize' : 'grab',
        boxShadow: isDragging ? `0 0 12px ${color}` : undefined,
        zIndex: resizeSide ? 20 : 1,
      }}
      {...(resizeSide ? {} : { ...listeners, ...attributes })}
      onClick={() => { if (!resizeSide) onSelect?.(task.id) }}
    >
      {/* Title */}
      <span
        className="absolute inset-0 flex items-center px-2 text-[10px] font-medium truncate text-[var(--bg)]"
        
      >
        {task.title}
      </span>

      {/* Resize handles (only for duration tasks) */}
      {hasDuration && !isDragging && (
        <>
          <div
            className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize opacity-0 group-hover/bar:opacity-100 transition-opacity rounded-l-md"
            style={{ background: 'rgba(0,0,0,0.3)' }}
            onMouseDown={(e) => handleResizeStart(e, 'left')}
            onTouchStart={(e) => handleResizeStart(e, 'left')}
          />
          <div
            className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize opacity-0 group-hover/bar:opacity-100 transition-opacity rounded-r-md"
            style={{ background: 'rgba(0,0,0,0.3)' }}
            onMouseDown={(e) => handleResizeStart(e, 'right')}
            onTouchStart={(e) => handleResizeStart(e, 'right')}
          />
        </>
      )}
    </div>
  )
}
