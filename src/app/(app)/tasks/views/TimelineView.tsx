'use client'

import { useState, useRef, useEffect } from 'react'
import { DndContext, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import type { Task } from '@/lib/db/repositories/task.repository'
import { TaskCard } from '../TaskCard'
import { useDndSensors } from '../dnd/use-dnd-sensors'
import { TaskDragOverlay } from '../dnd/TaskDragOverlay'
import { normalizeDate, toDateStr, addDays, getMonday } from '@/lib/date-utils'
import { updateTaskDate } from '../actions'
import { TimelineTaskBar } from './TimelineTaskBar'

type ZoomLevel = 'week' | 'month'
const ZOOM_STORAGE_KEY = 'clawdos:timeline-zoom'

interface TimelineViewProps {
  tasks: Task[]
  onUpdate: (task: Task) => void
  onDelete: (taskId: string) => void
  subtaskCounts: Map<string, number>
  onSelectTask?: (taskId: string) => void
}

export function TimelineView({ tasks, onUpdate, onDelete, onSelectTask }: TimelineViewProps) {
  const sensors = useDndSensors()
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [zoom, setZoomState] = useState<ZoomLevel>('week')

  // Persist zoom level in localStorage (UTIL-02)
  useEffect(() => {
    const saved = localStorage.getItem(ZOOM_STORAGE_KEY) as ZoomLevel | null
    if (saved === 'week' || saved === 'month') setZoomState(saved)
  }, [])

  const setZoom = (level: ZoomLevel) => {
    setZoomState(level)
    localStorage.setItem(ZOOM_STORAGE_KEY, level)
  }
  const scrollRef = useRef<HTMLDivElement>(null)
  const todayRef = useRef<HTMLDivElement>(null)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = toDateStr(today)

  const weeksBack = 2
  const weeksForward = zoom === 'week' ? 6 : 10
  const startDate = getMonday(addDays(today, -weeksBack * 7))
  const totalWeeks = weeksBack + weeksForward
  const totalDays = totalWeeks * 7
  const dayWidth = zoom === 'week' ? 120 : 40

  // Build day array
  const days: Array<{ date: Date; dateStr: string }> = []
  for (let i = 0; i < totalDays; i++) { const d = addDays(startDate, i); days.push({ date: d, dateStr: toDateStr(d) }) }

  // Build week markers
  const weeks: Array<{ label: string }> = []
  for (let i = 0; i < totalWeeks; i++) {
    const ws = addDays(startDate, i * 7)
    weeks.push({ label: ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) })
  }

  // Build date-to-index map for fast lookup
  const dateToIdx = new Map<string, number>()
  days.forEach((d, i) => dateToIdx.set(d.dateStr, i))

  // Compute task bars with position info
  const taskBars: Array<{ task: Task; startIdx: number; spanDays: number }> = []
  const undatedTasks: Task[] = []

  for (const task of tasks) {
    const dueStr = normalizeDate(task.dueDate)
    const startStr = normalizeDate(task.startDate)
    const effectiveStart = startStr || dueStr
    const effectiveEnd = dueStr || startStr
    if (!effectiveStart || !effectiveEnd) { undatedTasks.push(task); continue }

    const sIdx = dateToIdx.get(effectiveStart)
    const eIdx = dateToIdx.get(effectiveEnd)
    if (sIdx === undefined && eIdx === undefined) {
      // Task outside visible range — check if it spans through
      if (effectiveStart < days[0].dateStr && effectiveEnd > days[days.length - 1].dateStr) {
        taskBars.push({ task, startIdx: 0, spanDays: totalDays })
      }
      continue
    }
    const si = sIdx ?? 0
    const ei = eIdx ?? totalDays - 1
    taskBars.push({ task, startIdx: si, spanDays: Math.max(1, ei - si + 1) })
  }

  // Stack bars vertically to avoid overlaps
  const barRows: number[] = new Array(taskBars.length).fill(0)
  const occupied: Array<{ endIdx: number; row: number }> = []
  for (let i = 0; i < taskBars.length; i++) {
    const { startIdx, spanDays } = taskBars[i]
    let row = 0
    for (const o of occupied) {
      if (startIdx <= o.endIdx && o.row === row) { row = o.row + 1 }
    }
    barRows[i] = row
    occupied.push({ endIdx: startIdx + spanDays - 1, row })
  }
  const maxRow = barRows.length > 0 ? Math.max(...barRows) : 0
  const rowHeight = 34
  const contentHeight = Math.max(200, (maxRow + 1) * rowHeight + 16)

  // Scroll to today on mount/zoom change
  useEffect(() => {
    if (todayRef.current && scrollRef.current) {
      scrollRef.current.scrollLeft = todayRef.current.offsetLeft - scrollRef.current.clientWidth / 3
    }
  }, [zoom])

  const handleDragStart = (e: DragStartEvent) => { setActiveTask((e.active.data.current?.task as Task) || null) }

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveTask(null)
    const task = e.active.data.current?.task as Task
    if (!task || !e.delta) return

    const daysMoved = Math.round(e.delta.x / dayWidth)
    if (daysMoved === 0) return

    const dueStr = normalizeDate(task.dueDate)
    const startStr = normalizeDate(task.startDate)
    const newDue = dueStr ? toDateStr(addDays(new Date(dueStr + 'T00:00'), daysMoved)) : null
    const newStart = startStr ? toDateStr(addDays(new Date(startStr + 'T00:00'), daysMoved)) : null

    const updated = { ...task, dueDate: newDue, startDate: newStart }
    onUpdate(updated)

    updateTaskDate(task.id, { dueDate: newDue, startDate: newStart }).then((res) => {
      if (res.error) onUpdate(task)
      else if (res.task) onUpdate(res.task)
    })
  }

  const handleResize = (taskId: string, newStart: string | null, newDue: string | null) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return

    const updated = { ...task, startDate: newStart, dueDate: newDue }
    onUpdate(updated)

    updateTaskDate(taskId, { startDate: newStart, dueDate: newDue }).then((res) => {
      if (res.error) onUpdate(task)
      else if (res.task) onUpdate(res.task)
    })
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-3">
        {/* Zoom controls */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium" style={{ color: 'var(--muted)' }}>Timeline</h3>
          <div className="flex p-0.5 rounded-lg" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            {(['week', 'month'] as const).map((level) => (
              <button key={level} type="button" onClick={() => setZoom(level)} className="px-3 py-1 rounded-md text-xs font-medium transition-colors"
                style={{ background: zoom === level ? 'var(--neon)' : 'transparent', color: zoom === level ? 'var(--bg)' : 'var(--muted)' }}>
                {level === 'week' ? 'Week' : 'Month'}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable timeline */}
        <div ref={scrollRef} className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--border)' }}>
          <div style={{ minWidth: totalDays * dayWidth }}>
            {/* Week headers */}
            <div className="flex" style={{ borderBottom: '1px solid var(--border)' }}>
              {weeks.map((w, i) => (
                <div key={i} className="text-xs font-mono py-2 text-center flex-shrink-0"
                  style={{ width: 7 * dayWidth, color: 'var(--muted)', background: 'var(--card)', borderRight: '1px solid var(--border)' }}>
                  {w.label}
                </div>
              ))}
            </div>

            {/* Day headers */}
            <div className="flex" style={{ borderBottom: '1px solid var(--border)' }}>
              {days.map(({ date, dateStr }) => {
                const isToday = dateStr === todayStr
                const isWeekend = date.getDay() === 0 || date.getDay() === 6
                return (
                  <div key={dateStr} ref={isToday ? todayRef : undefined} className="flex-shrink-0 text-center py-1.5"
                    style={{ width: dayWidth, color: isToday ? 'var(--neon)' : isWeekend ? 'var(--border)' : 'var(--muted)', fontSize: zoom === 'week' ? '10px' : '9px', fontFamily: 'var(--font-mono)', fontWeight: isToday ? 700 : 400, borderRight: '1px solid var(--border)', background: isToday ? 'rgba(167, 139, 250, 0.06)' : undefined }}>
                    {zoom === 'week' ? date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }) : date.getDate()}
                  </div>
                )
              })}
            </div>

            {/* Task bars area */}
            <div className="relative" style={{ height: contentHeight }}>
              {/* Column backgrounds */}
              <div className="absolute inset-0 flex pointer-events-none">
                {days.map(({ dateStr }) => (
                  <div key={dateStr} className="flex-shrink-0 h-full" style={{ width: dayWidth, borderRight: '1px solid var(--border)', background: dateStr === todayStr ? 'rgba(167, 139, 250, 0.04)' : undefined }} />
                ))}
              </div>

              {/* Today line */}
              {dateToIdx.has(todayStr) && (
                <div className="absolute top-0 bottom-0 w-0.5 z-10" style={{ left: dateToIdx.get(todayStr)! * dayWidth + dayWidth / 2, background: 'var(--neon)', boxShadow: '0 0 8px var(--neon-glow)' }} />
              )}

              {/* Task bars */}
              <div className="relative" style={{ padding: '8px 0' }}>
                {taskBars.map((bar, i) => (
                  <div key={bar.task.id} style={{ position: 'absolute', top: barRows[i] * rowHeight + 4, left: 0, right: 0, height: rowHeight }}>
                    <TimelineTaskBar task={bar.task} dayWidth={dayWidth} startIdx={bar.startIdx} spanDays={bar.spanDays} onUpdate={onUpdate} onResize={handleResize} onSelect={onSelectTask} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Undated */}
        {undatedTasks.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--muted)' }}>No date ({undatedTasks.length})</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {undatedTasks.map((task) => <TaskCard key={task.id} task={task} onUpdate={onUpdate} onDelete={onDelete} showStatus onSelect={onSelectTask} />)}
            </div>
          </div>
        )}
      </div>
      <TaskDragOverlay activeTask={activeTask} compact={zoom === 'month'} />
    </DndContext>
  )
}
