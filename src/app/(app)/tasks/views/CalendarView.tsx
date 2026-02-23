'use client'

import { useState } from 'react'
import { DndContext, useDroppable, useDraggable, closestCenter, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import type { Task } from '@/lib/db/repositories/task.repository'
import { TaskCard } from '../TaskCard'
import { useDndSensors } from '../dnd/use-dnd-sensors'
import { TaskDragOverlay } from '../dnd/TaskDragOverlay'
import { updateTaskDate } from '../actions'
import { normalizeDate, toDateStr, getMonthGrid } from '@/lib/date-utils'
import { CalendarSpanBars } from './CalendarSpanBars'

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

interface CalendarViewProps {
  tasks: Task[]
  onUpdate: (task: Task) => void
  onDelete: (taskId: string) => void
  subtaskCounts: Map<string, number>
  onSelectTask?: (taskId: string) => void
  projectMap?: Map<string, string>
}

const MAX_VISIBLE = 3

export function CalendarView({ tasks, onUpdate, onDelete, onSelectTask, projectMap }: CalendarViewProps) {
  const sensors = useDndSensors()
  const [activeTask, setActiveTask] = useState<Task | null>(null)

  const today = new Date()
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate())
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [expandedDay, setExpandedDay] = useState<string | null>(null)

  // Group single-day tasks by due date; separate duration tasks and undated
  const tasksByDate = new Map<string, Task[]>()
  const undatedTasks: Task[] = []
  const durationTasks: Task[] = []

  for (const task of tasks) {
    const startStr = normalizeDate(task.startDate)
    const dueStr = normalizeDate(task.dueDate)
    if (startStr && dueStr && startStr !== dueStr) {
      durationTasks.push(task)
      continue
    }
    const dateStr = dueStr || startStr
    if (!dateStr) { undatedTasks.push(task); continue }
    const existing = tasksByDate.get(dateStr) || []
    existing.push(task)
    tasksByDate.set(dateStr, existing)
  }

  const grid = getMonthGrid(viewYear, viewMonth)

  const prevMonth = () => { if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11) } else setViewMonth(viewMonth - 1) }
  const nextMonth = () => { if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0) } else setViewMonth(viewMonth + 1) }
  const goToday = () => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()) }

  const handleDragStart = (e: DragStartEvent) => {
    setActiveTask((e.active.data.current?.task as Task) || null)
  }

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveTask(null)
    const { active, over } = e
    if (!over) return
    const task = active.data.current?.task as Task
    if (!task) return

    const targetId = over.id as string

    // Drop onto "undated" zone — clear dates
    if (targetId === 'undated') {
      if (!task.dueDate && !task.startDate) return
      const updated = { ...task, dueDate: null, startDate: null }
      onUpdate(updated)
      updateTaskDate(task.id, { dueDate: null, startDate: null }).then((res) => {
        if (res.error) onUpdate(task)
        else if (res.task) onUpdate(res.task)
      })
      return
    }

    // Drop onto a calendar date
    const currentDate = normalizeDate(task.dueDate)
    if (currentDate === targetId) return

    // Shift start date by same offset if task has duration
    let startDateUpdate: string | null | undefined
    if (task.startDate && task.dueDate) {
      const oldDue = new Date(normalizeDate(task.dueDate) + 'T00:00')
      const newDue = new Date(targetId + 'T00:00')
      const diffMs = newDue.getTime() - oldDue.getTime()
      const oldStart = new Date(normalizeDate(task.startDate) + 'T00:00')
      const shifted = new Date(oldStart.getTime() + diffMs)
      startDateUpdate = shifted.toISOString().slice(0, 10)
    }

    const updated = { ...task, dueDate: targetId, startDate: startDateUpdate ?? task.startDate }
    onUpdate(updated)

    updateTaskDate(task.id, { dueDate: targetId, startDate: startDateUpdate }).then((res) => {
      if (res.error) onUpdate(task)
      else if (res.task) onUpdate(res.task)
    })
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-4">
        {/* Month header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--fg)' }}>{MONTHS[viewMonth]} {viewYear}</h2>
            <button type="button" onClick={goToday} className="px-2.5 py-1 rounded-md text-xs transition-colors" style={{ color: 'var(--neon)', border: '1px solid var(--neon-dim)' }}>Today</button>
          </div>
          <div className="flex gap-1">
            <NavButton onClick={prevMonth} d="M15 19l-7-7 7-7" />
            <NavButton onClick={nextMonth} d="M9 5l7 7-7 7" />
          </div>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-px">
          {DAYS.map((d) => <div key={d} className="text-center text-xs font-mono py-2" style={{ color: 'var(--muted)' }}>{d}</div>)}
        </div>

        {/* Calendar grid */}
        <div className="relative">
          <div className="grid grid-cols-7 gap-px rounded-xl overflow-hidden" style={{ background: 'var(--border)' }}>
            {grid.flat().map((day, i) => {
              if (day === null) return <div key={`e-${i}`} className="min-h-[100px] p-1.5" style={{ background: 'var(--bg)' }} />
              const dateStr = toDateStr(viewYear, viewMonth, day)
              return <DroppableDayCell key={dateStr} dateStr={dateStr} day={day} isToday={dateStr === todayStr} tasks={tasksByDate.get(dateStr) || []} expandedDay={expandedDay} setExpandedDay={setExpandedDay} onUpdate={onUpdate} onDelete={onDelete} onSelectTask={onSelectTask} projectMap={projectMap} />
            })}
          </div>

          {/* Multi-day span bars */}
          <CalendarSpanBars tasks={durationTasks} grid={grid} viewYear={viewYear} viewMonth={viewMonth} onUpdate={onUpdate} onDelete={onDelete} />
        </div>

        {/* Undated tasks (droppable zone — drag here to remove date) */}
        <UndatedDropZone tasks={undatedTasks} onUpdate={onUpdate} onDelete={onDelete} onSelectTask={onSelectTask} isDragging={!!activeTask} projectMap={projectMap} />
      </div>
      <TaskDragOverlay activeTask={activeTask} compact />
    </DndContext>
  )
}

function DroppableDayCell({ dateStr, day, isToday, tasks, expandedDay, setExpandedDay, onUpdate, onDelete, onSelectTask, projectMap }: {
  dateStr: string; day: number; isToday: boolean; tasks: Task[]
  expandedDay: string | null; setExpandedDay: (d: string | null) => void
  onUpdate: (t: Task) => void; onDelete: (id: string) => void
  onSelectTask?: (taskId: string) => void
  projectMap?: Map<string, string>
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dateStr })
  const isExpanded = expandedDay === dateStr
  const visibleTasks = isExpanded ? tasks : tasks.slice(0, MAX_VISIBLE)
  const overflow = tasks.length - MAX_VISIBLE

  return (
    <div ref={setNodeRef} className="min-h-[100px] p-1.5 transition-colors" style={{
      background: isOver ? 'rgba(167, 139, 250, 0.12)' : isToday ? 'rgba(167, 139, 250, 0.06)' : 'var(--bg)',
      outline: isOver ? '2px solid var(--neon)' : undefined,
      outlineOffset: '-2px',
    }}>
      <div className="flex items-center justify-between mb-1">
        <span className={`text-xs font-mono w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'font-bold' : ''}`}
          style={isToday ? { background: 'var(--neon)', color: 'var(--bg)' } : { color: 'var(--muted)' }}>{day}</span>
        {tasks.length > 0 && <span className="text-[9px] font-mono" style={{ color: 'var(--muted)' }}>{tasks.length}</span>}
      </div>
      <div className="space-y-0.5">
        {visibleTasks.map((task) => <DraggableCard key={task.id} task={task} onUpdate={onUpdate} onDelete={onDelete} compact onSelectTask={onSelectTask} projectName={task.projectId ? projectMap?.get(task.projectId) : undefined} />)}
        {overflow > 0 && !isExpanded && <button type="button" onClick={() => setExpandedDay(dateStr)} className="w-full text-[10px] py-0.5 rounded transition-colors hover:bg-[var(--surface)]" style={{ color: 'var(--neon)' }}>+{overflow} more</button>}
        {isExpanded && tasks.length > MAX_VISIBLE && <button type="button" onClick={() => setExpandedDay(null)} className="w-full text-[10px] py-0.5 rounded transition-colors hover:bg-[var(--surface)]" style={{ color: 'var(--muted)' }}>Show less</button>}
      </div>
    </div>
  )
}

function DraggableCard({ task, onUpdate, onDelete, compact, onSelectTask, projectName }: { task: Task; onUpdate: (t: Task) => void; onDelete: (id: string) => void; compact?: boolean; onSelectTask?: (taskId: string) => void; projectName?: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id, data: { task } })
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} style={{ opacity: isDragging ? 0.3 : 1, cursor: 'grab' }}>
      <TaskCard task={task} onUpdate={onUpdate} onDelete={onDelete} compact={compact} showStatus onSelect={onSelectTask} projectName={projectName} />
    </div>
  )
}

function UndatedDropZone({ tasks, onUpdate, onDelete, onSelectTask, isDragging, projectMap }: {
  tasks: Task[]; onUpdate: (t: Task) => void; onDelete: (id: string) => void
  onSelectTask?: (taskId: string) => void; isDragging: boolean
  projectMap?: Map<string, string>
}) {
  const { setNodeRef, isOver } = useDroppable({ id: 'undated' })
  const showZone = tasks.length > 0 || isDragging

  if (!showZone) return null

  return (
    <div ref={setNodeRef} className="rounded-xl p-3 transition-all" style={{
      background: isOver ? 'rgba(167, 139, 250, 0.08)' : 'var(--card)',
      border: isOver ? '2px solid var(--neon)' : '1px solid var(--border)',
      boxShadow: isOver ? '0 0 16px rgba(167, 139, 250, 0.2)' : undefined,
    }}>
      <h3 className="text-sm font-medium mb-2" style={{ color: isOver ? 'var(--neon)' : 'var(--muted)' }}>
        {isOver ? 'Drop to remove date' : `No date (${tasks.length})`}
      </h3>
      {tasks.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {tasks.map((task) => <DraggableCard key={task.id} task={task} onUpdate={onUpdate} onDelete={onDelete} onSelectTask={onSelectTask} projectName={task.projectId ? projectMap?.get(task.projectId) : undefined} />)}
        </div>
      ) : isDragging ? (
        <div className="text-center py-4 text-xs rounded-lg" style={{ color: isOver ? 'var(--neon)' : 'var(--muted)', border: `1px dashed ${isOver ? 'var(--neon)' : 'var(--border)'}` }}>
          Drop here to remove date
        </div>
      ) : null}
    </div>
  )
}

function NavButton({ onClick, d }: { onClick: () => void; d: string }) {
  return (
    <button type="button" onClick={onClick} className="p-2 rounded-lg transition-colors hover:bg-[var(--surface)]" style={{ color: 'var(--muted)' }}>
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} /></svg>
    </button>
  )
}
