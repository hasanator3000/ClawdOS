'use client'

import { useState, useTransition, useEffect, useMemo, useCallback } from 'react'
import type { Task } from '@/lib/db/repositories/task.repository'
import type { Project } from '@/lib/db/repositories/project.repository'
import { createTask, fetchAllTags, fetchProjects } from './actions'
import { TaskFilters, type TaskFilterState } from './TaskFilters'
import { TaskCreateForm } from './TaskCreateForm'
import { ViewModeSlider, useViewMode, type ViewMode } from './ViewModeSlider'
import dynamic from 'next/dynamic'
import { ListView } from './views/ListView'

function ViewSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-8 w-48 rounded-lg bg-[var(--hover)]" />
      <div className="h-64 rounded-xl bg-[var(--hover)]" />
    </div>
  )
}

const CalendarView = dynamic(
  () => import('./views/CalendarView').then(m => m.CalendarView),
  { loading: () => <ViewSkeleton />, ssr: false }
)
const KanbanView = dynamic(
  () => import('./views/KanbanView').then(m => m.KanbanView),
  { loading: () => <ViewSkeleton />, ssr: false }
)
const TimelineView = dynamic(
  () => import('./views/TimelineView').then(m => m.TimelineView),
  { loading: () => <ViewSkeleton />, ssr: false }
)
import { TaskDetailPanel } from './TaskDetailPanel'

interface TaskListProps {
  initialTasks: Task[]
}

export function TaskList({ initialTasks }: TaskListProps) {
  const [tasks, setTasks] = useState(initialTasks)
  const [viewMode, setViewMode] = useViewMode()
  const [filterState, setFilterState] = useState<TaskFilterState>({
    status: 'all',
    priority: 'all',
    tags: [],
    projectId: 'all',
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [allTags, setAllTags] = useState<string[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [isPending, startTransition] = useTransition()

  // Sync tasks when initialTasks change (e.g., workspace switch)
  useEffect(() => {
    setTasks(initialTasks)
  }, [initialTasks])

  // Fetch all unique tags and projects for filter dropdowns
  useEffect(() => {
    fetchAllTags().then((res) => {
      if (res.tags) setAllTags(res.tags)
    })
    fetchProjects().then((res) => {
      if (res.projects) setProjects(res.projects)
    })
  }, [])

  const reloadProjects = useCallback(() => {
    fetchProjects().then((res) => {
      if (res.projects) setProjects(res.projects)
    })
  }, [])

  // Listen for task updates + filter changes from chat AI
  useEffect(() => {
    const handleTaskRefresh = (event: CustomEvent) => {
      const actions = event.detail?.actions || []
      for (const result of actions) {
        if (result.task) {
          if (result.action === 'task.create') {
            setTasks((prev) => [result.task, ...prev])
          } else if (result.action === 'task.complete' || result.action === 'task.reopen') {
            setTasks((prev) => prev.map((t) => (t.id === result.task.id ? result.task : t)))
          }
        }
      }
    }

    const handleFilter = (event: CustomEvent) => {
      const value = event.detail?.value
      if (value === 'active' || value === 'completed' || value === 'all') {
        setFilterState((prev) => ({ ...prev, status: value }))
      }
    }

    window.addEventListener('clawdos:task-refresh', handleTaskRefresh as EventListener)
    window.addEventListener('clawdos:tasks-filter', handleFilter as EventListener)
    return () => {
      window.removeEventListener('clawdos:task-refresh', handleTaskRefresh as EventListener)
      window.removeEventListener('clawdos:tasks-filter', handleFilter as EventListener)
    }
  }, [])

  // Only show top-level tasks (no parent)
  const topLevelTasks = tasks.filter((t) => !t.parentId)

  // Pre-compute subtask counts from loaded tasks
  const subtaskCounts = new Map<string, number>()
  for (const t of tasks) {
    if (t.parentId) {
      subtaskCounts.set(t.parentId, (subtaskCounts.get(t.parentId) || 0) + 1)
    }
  }

  // Project lookup map
  const projectMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of projects) map.set(p.id, p.name)
    return map
  }, [projects])

  // Multi-dimensional filter logic
  const filteredTasks = topLevelTasks.filter((task) => {
    if (filterState.status === 'active') {
      if (task.status === 'done' || task.status === 'cancelled') return false
    } else if (filterState.status === 'completed') {
      if (task.status !== 'done') return false
    }
    if (filterState.priority !== 'all') {
      if (task.priority !== filterState.priority) return false
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const titleMatch = task.title.toLowerCase().includes(q)
      const descMatch = task.description?.toLowerCase().includes(q) ?? false
      const subtaskMatch = tasks.some((t) => t.parentId === task.id && t.title.toLowerCase().includes(q))
      if (!titleMatch && !descMatch && !subtaskMatch) return false
    }
    if (filterState.tags.length > 0) {
      if (!filterState.tags.some((tag) => task.tags.includes(tag))) return false
    }
    if (filterState.projectId !== 'all') {
      if (task.projectId !== filterState.projectId) return false
    }
    return true
  })

  const handleCreateTask = (data: { title: string; priority: number; dueDate?: string; dueTime?: string; startDate?: string; startTime?: string; tags?: string[] }) => {
    startTransition(async () => {
      const result = await createTask({
        title: data.title,
        priority: data.priority,
        dueDate: data.dueDate,
        dueTime: data.dueTime,
        startDate: data.startDate,
        startTime: data.startTime,
        tags: data.tags,
      })
      if (result.task) {
        setTasks((prev) => [result.task!, ...prev])
      }
    })
  }

  const handleTaskUpdate = (updated: Task) => {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
  }

  const handleTaskDelete = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
  }

  const activeTasks = tasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled' && !t.parentId)
  const completedTasks = tasks.filter((t) => t.status === 'done' && !t.parentId)

  const selectedTask = selectedTaskId ? tasks.find((t) => t.id === selectedTaskId) ?? null : null

  const viewProps = {
    tasks: filteredTasks,
    onUpdate: handleTaskUpdate,
    onDelete: handleTaskDelete,
    subtaskCounts,
    onSelectTask: (taskId: string) => setSelectedTaskId(taskId),
    projectMap,
  }

  return (
    <div className="space-y-6">
      {/* View mode switcher */}
      <ViewModeSlider value={viewMode} onChange={setViewMode} />

      {/* New task form */}
      <TaskCreateForm onSubmit={handleCreateTask} disabled={isPending} />

      {/* Filters */}
      <TaskFilters
        onFilterChange={setFilterState}
        onSearchChange={setSearchQuery}
        activeTasks={activeTasks.length}
        completedTasks={completedTasks.length}
        totalTasks={topLevelTasks.length}
        allTags={allTags}
        projects={projects}
      />

      {/* View */}
      {viewMode === 'list' && <ListView {...viewProps} />}
      {viewMode === 'calendar' && <CalendarView {...viewProps} />}
      {viewMode === 'kanban' && <KanbanView {...viewProps} />}
      {viewMode === 'timeline' && <TimelineView {...viewProps} />}

      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          onUpdate={handleTaskUpdate}
          onDelete={(id) => { handleTaskDelete(id); setSelectedTaskId(null) }}
          onClose={() => setSelectedTaskId(null)}
          projects={projects}
          onProjectsChange={reloadProjects}
        />
      )}
    </div>
  )
}
