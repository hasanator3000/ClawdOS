'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import type { Task } from '@/lib/db/repositories/task.repository'
import type { Project } from '@/lib/db/repositories/project.repository'
import { normalizeDate, formatShortDate } from '@/lib/date-utils'
import { getTagColor } from '@/lib/tag-colors'
import { recurrenceLabel } from '@/lib/recurrence'
import type { RecurrenceRule, RecurrenceType } from '@/lib/db/repositories/task.repository'
import {
  updateTask,
  completeTask,
  reopenTask,
  createTask,
  deleteTask,
  fetchSubtasks,
  fetchAllTags,
  fetchProjects,
  createProject as createProjectAction,
  updateRecurrence,
} from './actions'
import { DateTimePicker } from './DateTimePicker'

const STATUS_OPTIONS: Array<{ value: Task['status']; label: string; color: string; bg: string }> = [
  { value: 'todo', label: 'To Do', color: 'var(--cyan)', bg: 'rgba(0, 188, 212, 0.12)' },
  { value: 'in_progress', label: 'In Progress', color: 'var(--warm)', bg: 'rgba(255, 171, 64, 0.12)' },
  { value: 'done', label: 'Done', color: 'var(--green)', bg: 'rgba(76, 175, 80, 0.12)' },
  { value: 'cancelled', label: 'Cancelled', color: 'var(--muted)', bg: 'rgba(128, 128, 128, 0.12)' },
]

const PRIORITY_OPTIONS = [
  { value: 0, label: 'None', color: '' },
  { value: 1, label: 'Low', color: 'var(--cyan)' },
  { value: 2, label: 'Medium', color: 'var(--warm)' },
  { value: 3, label: 'High', color: 'var(--pink)' },
  { value: 4, label: 'Urgent', color: 'var(--red)' },
]

interface TaskDetailPanelProps {
  task: Task
  onUpdate: (task: Task) => void
  onDelete: (taskId: string) => void
  onClose: () => void
  projects?: Project[]
  onProjectsChange?: () => void
}

export function TaskDetailPanel({ task, onUpdate, onDelete, onClose, projects = [], onProjectsChange }: TaskDetailPanelProps) {
  const [isPending, startTransition] = useTransition()
  const [isVisible, setIsVisible] = useState(false)
  const [editingField, setEditingField] = useState<'title' | 'description' | null>(null)
  const [editTitle, setEditTitle] = useState(task.title)
  const [editDescription, setEditDescription] = useState(task.description || '')
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [subtasks, setSubtasks] = useState<Task[]>([])
  const [subtasksLoaded, setSubtasksLoaded] = useState(false)
  const [newSubtask, setNewSubtask] = useState('')
  const [newTag, setNewTag] = useState('')
  const [allTags, setAllTags] = useState<string[]>([])
  const [tagsLoaded, setTagsLoaded] = useState(false)
  const [showProjectPicker, setShowProjectPicker] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [showRecurrencePicker, setShowRecurrencePicker] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const descRef = useRef<HTMLTextAreaElement>(null)

  // Animate in
  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true))
  }, [])

  // Sync edit values when switching tasks
  useEffect(() => {
    setEditTitle(task.title)
    setEditDescription(task.description || '')
    setEditingField(null)
    setShowDatePicker(false)
    setSubtasksLoaded(false)
    setSubtasks([])
    setNewTag('')
  }, [task.id])

  // Fetch all workspace tags for suggestions
  useEffect(() => {
    if (tagsLoaded) return
    setTagsLoaded(true)
    fetchAllTags().then((res) => {
      if (res.tags) setAllTags(res.tags)
    })
  }, [tagsLoaded])

  // Fetch subtasks on open
  useEffect(() => {
    if (subtasksLoaded) return
    setSubtasksLoaded(true)
    fetchSubtasks(task.id).then((res) => {
      if (res.tasks) setSubtasks(res.tasks)
    })
  }, [task.id, subtasksLoaded])

  // Escape key (don't close when editing a field or date picker is open)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !editingField && !showDatePicker) handleClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [editingField, showDatePicker])

  // Focus title input when editing
  useEffect(() => {
    if (editingField === 'title') titleInputRef.current?.focus()
    if (editingField === 'description') descRef.current?.focus()
  }, [editingField])

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(onClose, 300)
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) handleClose()
  }

  // --- Field updates with optimistic pattern ---
  const handleSaveTitle = () => {
    const trimmed = editTitle.trim()
    if (!trimmed || trimmed === task.title) { setEditingField(null); return }
    const updated = { ...task, title: trimmed }
    onUpdate(updated)
    setEditingField(null)
    startTransition(async () => {
      const result = await updateTask(task.id, { title: trimmed })
      if (result.error) onUpdate(task)
      else if (result.task) onUpdate(result.task)
    })
  }

  const handleSaveDescription = () => {
    const val = editDescription.trim()
    if (val === (task.description || '')) { setEditingField(null); return }
    const updated = { ...task, description: val || null }
    onUpdate(updated)
    setEditingField(null)
    startTransition(async () => {
      const result = await updateTask(task.id, { description: val || undefined })
      if (result.error) onUpdate(task)
      else if (result.task) onUpdate(result.task)
    })
  }

  const handleStatusChange = (status: Task['status']) => {
    if (status === task.status) return
    const updated = { ...task, status }
    onUpdate(updated)
    startTransition(async () => {
      const result = await updateTask(task.id, { status })
      if (result.error) onUpdate(task)
      else if (result.task) onUpdate(result.task)
    })
  }

  const handlePriorityChange = (priority: number) => {
    if (priority === task.priority) return
    const updated = { ...task, priority }
    onUpdate(updated)
    startTransition(async () => {
      const result = await updateTask(task.id, { priority })
      if (result.error) onUpdate(task)
      else if (result.task) onUpdate(result.task)
    })
  }

  const handleDateSave = (dueDate: string, dueTime: string, startDate?: string, startTime?: string) => {
    setShowDatePicker(false)
    const updated = {
      ...task,
      dueDate: dueDate || null,
      dueTime: dueTime || null,
      startDate: startDate || null,
      startTime: startTime || null,
    }
    onUpdate(updated)
    startTransition(async () => {
      const result = await updateTask(task.id, {
        dueDate: dueDate || null,
        dueTime: dueTime || null,
        startDate: startDate || null,
        startTime: startTime || null,
      })
      if (result.error) onUpdate(task)
      else if (result.task) onUpdate(result.task)
    })
  }

  const handleAddTag = (tag: string) => {
    const trimmed = tag.trim().toLowerCase()
    if (!trimmed || task.tags.includes(trimmed)) { setNewTag(''); return }
    const newTags = [...task.tags, trimmed]
    const updated = { ...task, tags: newTags }
    onUpdate(updated)
    setNewTag('')
    if (!allTags.includes(trimmed)) setAllTags((prev) => [...prev, trimmed].sort())
    startTransition(async () => {
      const result = await updateTask(task.id, { tags: newTags })
      if (result.error) onUpdate(task)
      else if (result.task) onUpdate(result.task)
    })
  }

  const handleRemoveTag = (tag: string) => {
    const newTags = task.tags.filter((t) => t !== tag)
    const updated = { ...task, tags: newTags }
    onUpdate(updated)
    startTransition(async () => {
      const result = await updateTask(task.id, { tags: newTags })
      if (result.error) onUpdate(task)
      else if (result.task) onUpdate(result.task)
    })
  }

  const handleProjectChange = (projectId: string | null) => {
    const updated = { ...task, projectId }
    onUpdate(updated)
    setShowProjectPicker(false)
    startTransition(async () => {
      const result = await updateTask(task.id, { projectId })
      if (result.error) onUpdate(task)
      else if (result.task) onUpdate(result.task)
    })
  }

  const handleCreateProject = () => {
    const name = newProjectName.trim()
    if (!name) return
    setNewProjectName('')
    startTransition(async () => {
      const result = await createProjectAction(name)
      if (result.project) {
        onProjectsChange?.()
        handleProjectChange(result.project.id)
      }
    })
  }

  const handleRecurrenceChange = (rule: RecurrenceRule | null) => {
    const updated = { ...task, recurrenceRule: rule }
    onUpdate(updated)
    setShowRecurrencePicker(false)
    startTransition(async () => {
      const result = await updateRecurrence(task.id, rule)
      if (result.error) onUpdate(task)
      else if (result.task) onUpdate(result.task)
    })
  }

  const handleDelete = () => {
    handleClose()
    setTimeout(() => onDelete(task.id), 300)
  }

  // --- Subtask operations ---
  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSubtask.trim()) return
    const title = newSubtask.trim()
    setNewSubtask('')
    startTransition(async () => {
      const result = await createTask({ title, parentId: task.id })
      if (result.task) setSubtasks((prev) => [result.task!, ...prev])
    })
  }

  const handleSubtaskToggle = (sub: Task) => {
    const isDone = sub.status === 'done'
    const updated = { ...sub, status: (isDone ? 'todo' : 'done') as Task['status'] }
    setSubtasks((prev) => prev.map((t) => (t.id === sub.id ? updated : t)))
    startTransition(async () => {
      const result = isDone ? await reopenTask(sub.id) : await completeTask(sub.id)
      if (result.task) setSubtasks((prev) => prev.map((t) => (t.id === result.task!.id ? result.task! : t)))
    })
  }

  const handleSubtaskDelete = (subId: string) => {
    setSubtasks((prev) => prev.filter((t) => t.id !== subId))
    startTransition(async () => {
      await deleteTask(subId)
    })
  }

  const doneCount = subtasks.filter((s) => s.status === 'done').length
  const currentStatus = STATUS_OPTIONS.find((s) => s.value === task.status)
  const currentPriority = PRIORITY_OPTIONS.find((p) => p.value === task.priority)

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      onClick={handleBackdropClick}
      style={{
        background: isVisible ? 'rgba(0, 0, 0, 0.6)' : 'transparent',
        transition: 'background 200ms ease-out',
      }}
    >
      <div
        ref={panelRef}
        className="w-full md:w-[420px] h-full flex flex-col overflow-hidden"
        style={{
          background: 'var(--bg)',
          borderLeft: '1px solid var(--border)',
          transform: isVisible ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 300ms ease-out',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex-1 min-w-0">
            {editingField === 'title' ? (
              <input
                ref={titleInputRef}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveTitle(); if (e.key === 'Escape') { setEditTitle(task.title); setEditingField(null) } }}
                className="w-full text-lg font-semibold bg-transparent border-b-2 outline-none py-1"
                style={{ color: 'var(--fg)', borderColor: 'var(--neon)' }}
              />
            ) : (
              <h2
                className="text-lg font-semibold cursor-pointer hover:text-[var(--neon)] transition-colors"
                style={{ color: 'var(--fg)' }}
                onClick={() => setEditingField('title')}
              >
                {task.title}
              </h2>
            )}
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-[var(--surface)] transition-colors flex-shrink-0"
            style={{ color: 'var(--muted)' }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Status */}
          <Section label="Status">
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleStatusChange(opt.value)}
                  className="px-2.5 py-1 rounded-md text-xs font-medium transition-all"
                  style={{
                    color: opt.color,
                    background: task.status === opt.value ? opt.bg : 'transparent',
                    border: task.status === opt.value ? `1px solid ${opt.color}` : '1px solid var(--border)',
                    opacity: task.status === opt.value ? 1 : 0.6,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Section>

          {/* Priority */}
          <Section label="Priority">
            <div className="flex items-center gap-1">
              {PRIORITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handlePriorityChange(opt.value)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                    task.priority === opt.value ? 'scale-110' : 'opacity-40 hover:opacity-70'
                  }`}
                  title={opt.label}
                  style={task.priority === opt.value ? { background: 'var(--surface)', border: '1px solid var(--border)' } : undefined}
                >
                  {opt.value === 0 ? (
                    <span className="text-sm" style={{ color: 'var(--muted)' }}>—</span>
                  ) : (
                    <span className="w-3 h-3 rounded-full" style={{ background: opt.color, boxShadow: task.priority === opt.value ? `0 0 8px ${opt.color}` : 'none' }} />
                  )}
                </button>
              ))}
              {currentPriority && currentPriority.value > 0 && (
                <span className="text-xs font-medium ml-2" style={{ color: currentPriority.color }}>{currentPriority.label}</span>
              )}
            </div>
          </Section>

          {/* Dates */}
          <Section label="Dates">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowDatePicker(!showDatePicker)}
                className="px-3 py-1.5 rounded-lg text-sm transition-colors"
                style={{
                  color: task.dueDate ? 'var(--neon)' : 'var(--muted)',
                  background: task.dueDate ? 'var(--neon-dim)' : 'var(--surface)',
                  border: '1px solid var(--border)',
                }}
              >
                {task.startDate && task.dueDate && normalizeDate(task.startDate) !== normalizeDate(task.dueDate)
                  ? `${formatShortDate(task.startDate)} - ${formatShortDate(task.dueDate)}`
                  : task.dueDate
                    ? formatShortDate(task.dueDate) + (task.dueTime ? ` ${task.dueTime}` : '')
                    : 'Set date...'}
              </button>
              {showDatePicker && (
                <DateTimePicker
                  date={normalizeDate(task.dueDate)}
                  time={task.dueTime || ''}
                  startDate={normalizeDate(task.startDate)}
                  startTime={task.startTime || ''}
                  onSave={handleDateSave}
                  onCancel={() => setShowDatePicker(false)}
                />
              )}
            </div>
          </Section>

          {/* Tags */}
          <Section label="Tags">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {task.tags.map((tag) => {
                const tc = getTagColor(tag)
                return (
                  <span key={tag} className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full" style={{ color: tc.color, background: tc.bg }}>
                    {tag}
                    <button type="button" onClick={() => handleRemoveTag(tag)} className="hover:opacity-60 transition-opacity">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </span>
                )
              })}
            </div>
            <div className="relative">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(newTag) } }}
                placeholder="Add tag..."
                className="w-full px-3 py-1.5 rounded-lg text-sm bg-transparent outline-none focus:border-[var(--neon)] transition-colors"
                style={{ border: '1px solid var(--border)', color: 'var(--fg)' }}
              />
              {newTag && allTags.filter((t) => t.includes(newTag.toLowerCase()) && !task.tags.includes(t)).length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 rounded-lg overflow-hidden z-10 max-h-32 overflow-y-auto" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                  {allTags.filter((t) => t.includes(newTag.toLowerCase()) && !task.tags.includes(t)).slice(0, 6).map((tag) => (
                    <button key={tag} type="button" onClick={() => handleAddTag(tag)} className="w-full px-3 py-1.5 text-left text-sm hover:bg-[var(--surface)] transition-colors" style={{ color: 'var(--fg)' }}>
                      {tag}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Section>

          {/* Project */}
          <Section label="Project">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowProjectPicker(!showProjectPicker)}
                className="px-3 py-1.5 rounded-lg text-sm transition-colors"
                style={{
                  color: task.projectId ? 'var(--cyan)' : 'var(--muted)',
                  background: task.projectId ? 'rgba(0, 188, 212, 0.1)' : 'var(--surface)',
                  border: '1px solid var(--border)',
                }}
              >
                {projects.find((p) => p.id === task.projectId)?.name || 'No project'}
              </button>
              {showProjectPicker && (
                <div className="absolute left-0 top-full mt-1 min-w-[200px] rounded-lg shadow-lg z-20 overflow-hidden" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                  <button type="button" onClick={() => handleProjectChange(null)} className={`w-full px-3 py-2 text-left text-sm transition-colors ${!task.projectId ? 'bg-[var(--neon-dim)]' : 'hover:bg-[var(--surface)]'}`} style={{ color: 'var(--muted)' }}>
                    No project
                  </button>
                  {projects.map((p) => (
                    <button key={p.id} type="button" onClick={() => handleProjectChange(p.id)} className={`w-full px-3 py-2 text-left text-sm transition-colors ${task.projectId === p.id ? 'bg-[var(--neon-dim)]' : 'hover:bg-[var(--surface)]'}`} style={{ color: 'var(--cyan)' }}>
                      {p.name}
                    </button>
                  ))}
                  <div className="px-3 py-2" style={{ borderTop: '1px solid var(--border)' }}>
                    <form onSubmit={(e) => { e.preventDefault(); handleCreateProject() }} className="flex gap-1.5">
                      <input type="text" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="New project..." className="flex-1 px-2 py-1 rounded text-xs bg-transparent outline-none focus:border-[var(--neon)]" style={{ border: '1px solid var(--border)', color: 'var(--fg)' }} />
                      <button type="submit" disabled={!newProjectName.trim()} className="px-2 py-1 rounded text-xs font-medium disabled:opacity-30" style={{ color: 'var(--neon)' }}>+</button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </Section>

          {/* Recurrence (REC-01, REC-03) */}
          <Section label="Repeat">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowRecurrencePicker(!showRecurrencePicker)}
                className="px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-2"
                style={{
                  color: task.recurrenceRule ? 'var(--cyan)' : 'var(--muted)',
                  background: task.recurrenceRule ? 'rgba(0, 188, 212, 0.1)' : 'var(--surface)',
                  border: '1px solid var(--border)',
                }}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {task.recurrenceRule ? recurrenceLabel(task.recurrenceRule) : 'No repeat'}
              </button>
              {showRecurrencePicker && (
                <RecurrencePicker
                  current={task.recurrenceRule}
                  onChange={handleRecurrenceChange}
                  onClose={() => setShowRecurrencePicker(false)}
                />
              )}
            </div>
          </Section>

          {/* Description */}
          <Section label="Description">
            {editingField === 'description' ? (
              <textarea
                ref={descRef}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                onBlur={handleSaveDescription}
                onKeyDown={(e) => { if (e.key === 'Escape') { setEditDescription(task.description || ''); setEditingField(null) } }}
                rows={4}
                className="w-full px-3 py-2 rounded-lg text-sm bg-transparent resize-none outline-none"
                style={{ border: '1px solid var(--neon)', color: 'var(--fg)' }}
                placeholder="Add description..."
              />
            ) : (
              <div
                className="px-3 py-2 rounded-lg text-sm cursor-pointer min-h-[60px] transition-colors hover:bg-[var(--surface)]"
                style={{ color: task.description ? 'var(--fg)' : 'var(--muted)', border: '1px solid var(--border)' }}
                onClick={() => setEditingField('description')}
              >
                {task.description || 'Click to add description...'}
              </div>
            )}
          </Section>

          {/* Subtasks */}
          <Section label={`Subtasks${subtasks.length > 0 ? ` (${doneCount}/${subtasks.length})` : ''}`}>
            {/* Progress bar */}
            {subtasks.length > 0 && (
              <div className="h-1 rounded-full mb-3" style={{ background: 'var(--surface)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${(doneCount / subtasks.length) * 100}%`, background: 'var(--green)' }}
                />
              </div>
            )}

            {/* Add form */}
            <form onSubmit={handleAddSubtask} className="flex gap-2 mb-2">
              <input
                type="text"
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                placeholder="Add subtask..."
                className="flex-1 px-3 py-1.5 rounded-lg text-sm bg-transparent outline-none focus:border-[var(--neon)] transition-colors"
                style={{ border: '1px solid var(--border)', color: 'var(--fg)' }}
                disabled={isPending}
              />
              <button
                type="submit"
                disabled={!newSubtask.trim() || isPending}
                className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-30 transition-opacity"
                style={{ color: 'var(--neon)', border: '1px solid var(--neon-dim)' }}
              >
                Add
              </button>
            </form>

            {/* Subtask list */}
            <div className="space-y-1">
              {subtasks.map((sub) => (
                <SubtaskRow key={sub.id} task={sub} onToggle={() => handleSubtaskToggle(sub)} onDelete={() => handleSubtaskDelete(sub.id)} />
              ))}
            </div>
          </Section>

          {/* Delete */}
          <div className="pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            <button
              type="button"
              onClick={handleDelete}
              className="text-xs transition-colors hover:text-[var(--red)]"
              style={{ color: 'var(--muted)' }}
            >
              Delete task
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>{label}</div>
      {children}
    </div>
  )
}

const RECURRENCE_PRESETS: Array<{ label: string; rule: RecurrenceRule }> = [
  { label: 'Daily', rule: { type: 'daily', interval: 1 } },
  { label: 'Weekly', rule: { type: 'weekly', interval: 1 } },
  { label: 'Bi-weekly', rule: { type: 'weekly', interval: 2 } },
  { label: 'Monthly', rule: { type: 'monthly', interval: 1 } },
]

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function RecurrencePicker({
  current,
  onChange,
  onClose,
}: {
  current: RecurrenceRule | null
  onChange: (rule: RecurrenceRule | null) => void
  onClose: () => void
}) {
  const [customWeekdays, setCustomWeekdays] = useState<number[]>(
    current?.type === 'custom' ? current.weekdays || [] : []
  )

  const toggleWeekday = (day: number) => {
    setCustomWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    )
  }

  const applyCustom = () => {
    if (customWeekdays.length === 0) return
    onChange({ type: 'custom', interval: 1, weekdays: customWeekdays })
  }

  return (
    <div
      className="absolute left-0 top-full mt-1 min-w-[220px] rounded-lg shadow-lg z-20 overflow-hidden"
      style={{ background: 'var(--bg)', border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
    >
      {/* Presets */}
      {RECURRENCE_PRESETS.map((preset) => {
        const isActive = current?.type === preset.rule.type && current?.interval === preset.rule.interval
        return (
          <button
            key={preset.label}
            type="button"
            onClick={() => onChange(preset.rule)}
            className={`w-full px-3 py-2 text-left text-sm transition-colors ${isActive ? 'bg-[var(--neon-dim)]' : 'hover:bg-[var(--surface)]'}`}
            style={{ color: isActive ? 'var(--cyan)' : 'var(--fg)' }}
          >
            {preset.label}
          </button>
        )
      })}

      {/* Custom weekdays */}
      <div className="px-3 py-2" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="text-[10px] font-mono uppercase mb-1.5" style={{ color: 'var(--muted)' }}>Custom days</div>
        <div className="flex gap-1 mb-1.5">
          {WEEKDAY_NAMES.map((name, i) => (
            <button
              key={name}
              type="button"
              onClick={() => toggleWeekday(i)}
              className="w-7 h-7 rounded text-[10px] font-medium transition-colors"
              style={{
                background: customWeekdays.includes(i) ? 'var(--cyan)' : 'var(--surface)',
                color: customWeekdays.includes(i) ? 'var(--bg)' : 'var(--muted)',
              }}
            >
              {name.slice(0, 2)}
            </button>
          ))}
        </div>
        {customWeekdays.length > 0 && (
          <button
            type="button"
            onClick={applyCustom}
            className="text-xs font-medium transition-colors"
            style={{ color: 'var(--cyan)' }}
          >
            Apply custom
          </button>
        )}
      </div>

      {/* Remove */}
      {current && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="w-full px-3 py-2 text-left text-xs transition-colors hover:bg-[var(--surface)]"
          style={{ color: 'var(--red)', borderTop: '1px solid var(--border)' }}
        >
          Remove recurrence
        </button>
      )}
    </div>
  )
}

function SubtaskRow({ task, onToggle, onDelete }: { task: Task; onToggle: () => void; onDelete: () => void }) {
  const isDone = task.status === 'done'
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg group hover:bg-[var(--surface)] transition-colors">
      <button
        type="button"
        onClick={onToggle}
        className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors"
        style={{ borderColor: isDone ? 'var(--green)' : 'var(--border)', background: isDone ? 'var(--green)' : 'transparent' }}
      >
        {isDone && (
          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="var(--bg)">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
      <span className={`flex-1 text-sm ${isDone ? 'line-through' : ''}`} style={{ color: isDone ? 'var(--muted)' : 'var(--fg)' }}>
        {task.title}
      </span>
      <button
        type="button"
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 p-0.5 transition-opacity"
        style={{ color: 'var(--muted)' }}
      >
        <svg className="w-3 h-3 hover:text-[var(--red)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

