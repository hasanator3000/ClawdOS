'use client'

import { useState, useEffect, useRef } from 'react'
import type { Task } from '@/lib/db/repositories/task.repository'
import type { Project } from '@/lib/db/repositories/project.repository'
import { normalizeDate, formatShortDate } from '@/lib/date-utils'
import { getTagColor } from '@/lib/tag-colors'
import { recurrenceLabel } from '@/lib/recurrence'
import { DateTimePicker } from './DateTimePicker'
import { STATUS_OPTIONS, PRIORITY_OPTIONS } from './task-detail/constants'
import { RecurrencePicker } from './task-detail/RecurrencePicker'
import { SubtaskSection } from './task-detail/SubtaskSection'
import { useTaskDetailHandlers } from './task-detail/useTaskDetailHandlers'

interface TaskDetailPanelProps {
  task: Task
  onUpdate: (task: Task) => void
  onDelete: (taskId: string) => void
  onClose: () => void
  projects?: Project[]
  onProjectsChange?: () => void
}

export function TaskDetailPanel({ task, onUpdate, onDelete, onClose, projects = [], onProjectsChange }: TaskDetailPanelProps) {
  const [isVisible, setIsVisible] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const descRef = useRef<HTMLTextAreaElement>(null)

  const h = useTaskDetailHandlers({ task, onUpdate, onDelete, onClose, onProjectsChange })

  // Animate in
  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true))
  }, [])

  // Escape key (don't close when editing a field or date picker is open)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !h.editingField && !h.showDatePicker) handleClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [h.editingField, h.showDatePicker])

  // Focus title input when editing
  useEffect(() => {
    if (h.editingField === 'title') titleInputRef.current?.focus()
    if (h.editingField === 'description') descRef.current?.focus()
  }, [h.editingField])

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(onClose, 300)
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) handleClose()
  }

  const handleDeleteWithAnimation = () => {
    handleClose()
    setTimeout(() => h.handleDelete(), 300)
  }

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
            {h.editingField === 'title' ? (
              <input
                ref={titleInputRef}
                value={h.editTitle}
                onChange={(e) => h.setEditTitle(e.target.value)}
                onBlur={h.handleSaveTitle}
                onKeyDown={(e) => { if (e.key === 'Enter') h.handleSaveTitle(); if (e.key === 'Escape') { h.setEditTitle(task.title); h.setEditingField(null) } }}
                className="w-full text-lg font-semibold bg-transparent border-b-2 outline-none py-1"
                style={{ color: 'var(--fg)', borderColor: 'var(--neon)' }}
              />
            ) : (
              <h2
                className="text-lg font-semibold cursor-pointer hover:text-[var(--neon)] transition-colors"
                style={{ color: 'var(--fg)' }}
                onClick={() => h.setEditingField('title')}
              >
                {task.title}
              </h2>
            )}
          </div>
          <button type="button" onClick={handleClose} className="p-1.5 rounded-lg hover:bg-[var(--surface)] transition-colors flex-shrink-0" style={{ color: 'var(--muted)' }}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Status */}
          <Section label="Status">
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map((opt) => (
                <button key={opt.value} type="button" onClick={() => h.handleStatusChange(opt.value)}
                  className="px-2.5 py-1 rounded-md text-xs font-medium transition-all"
                  style={{ color: opt.color, background: task.status === opt.value ? opt.bg : 'transparent', border: task.status === opt.value ? `1px solid ${opt.color}` : '1px solid var(--border)', opacity: task.status === opt.value ? 1 : 0.6 }}
                >{opt.label}</button>
              ))}
            </div>
          </Section>

          {/* Priority */}
          <Section label="Priority">
            <div className="flex items-center gap-1">
              {PRIORITY_OPTIONS.map((opt) => (
                <button key={opt.value} type="button" onClick={() => h.handlePriorityChange(opt.value)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${task.priority === opt.value ? 'scale-110' : 'opacity-40 hover:opacity-70'}`}
                  title={opt.label}
                  style={task.priority === opt.value ? { background: 'var(--surface)', border: '1px solid var(--border)' } : undefined}
                >
                  {opt.value === 0 ? <span className="text-sm" style={{ color: 'var(--muted)' }}>--</span> : <span className="w-3 h-3 rounded-full" style={{ background: opt.color, boxShadow: task.priority === opt.value ? `0 0 8px ${opt.color}` : 'none' }} />}
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
              <button type="button" onClick={() => h.setShowDatePicker(!h.showDatePicker)}
                className="px-3 py-1.5 rounded-lg text-sm transition-colors"
                style={{ color: task.dueDate ? 'var(--neon)' : 'var(--muted)', background: task.dueDate ? 'var(--neon-dim)' : 'var(--surface)', border: '1px solid var(--border)' }}
              >
                {task.startDate && task.dueDate && normalizeDate(task.startDate) !== normalizeDate(task.dueDate)
                  ? `${formatShortDate(task.startDate)} - ${formatShortDate(task.dueDate)}`
                  : task.dueDate ? formatShortDate(task.dueDate) + (task.dueTime ? ` ${task.dueTime}` : '') : 'Set date...'}
              </button>
              {h.showDatePicker && (
                <DateTimePicker date={normalizeDate(task.dueDate)} time={task.dueTime || ''} startDate={normalizeDate(task.startDate)} startTime={task.startTime || ''} onSave={h.handleDateSave} onCancel={() => h.setShowDatePicker(false)} />
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
                    <button type="button" onClick={() => h.handleRemoveTag(tag)} className="hover:opacity-60 transition-opacity">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </span>
                )
              })}
            </div>
            <div className="relative">
              <input type="text" value={h.newTag} onChange={(e) => h.setNewTag(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); h.handleAddTag(h.newTag) } }}
                placeholder="Add tag..." className="w-full px-3 py-1.5 rounded-lg text-sm bg-transparent outline-none focus:border-[var(--neon)] transition-colors"
                style={{ border: '1px solid var(--border)', color: 'var(--fg)' }}
              />
              {h.newTag && h.allTags.filter((t) => t.includes(h.newTag.toLowerCase()) && !task.tags.includes(t)).length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 rounded-lg overflow-hidden z-10 max-h-32 overflow-y-auto" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                  {h.allTags.filter((t) => t.includes(h.newTag.toLowerCase()) && !task.tags.includes(t)).slice(0, 6).map((tag) => (
                    <button key={tag} type="button" onClick={() => h.handleAddTag(tag)} className="w-full px-3 py-1.5 text-left text-sm hover:bg-[var(--surface)] transition-colors" style={{ color: 'var(--fg)' }}>{tag}</button>
                  ))}
                </div>
              )}
            </div>
          </Section>

          {/* Project */}
          <Section label="Project">
            <div className="relative">
              <button type="button" onClick={() => h.setShowProjectPicker(!h.showProjectPicker)}
                className="px-3 py-1.5 rounded-lg text-sm transition-colors"
                style={{ color: task.projectId ? 'var(--cyan)' : 'var(--muted)', background: task.projectId ? 'rgba(0, 188, 212, 0.1)' : 'var(--surface)', border: '1px solid var(--border)' }}
              >
                {projects.find((p) => p.id === task.projectId)?.name || 'No project'}
              </button>
              {h.showProjectPicker && (
                <>
                <div className="fixed inset-0 z-10" onClick={() => h.setShowProjectPicker(false)} />
                <div className="absolute left-0 top-full mt-1 min-w-[200px] rounded-lg shadow-lg z-20 overflow-hidden" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                  <button type="button" onClick={() => h.handleProjectChange(null)} className={`w-full px-3 py-2 text-left text-sm transition-colors ${!task.projectId ? 'bg-[var(--neon-dim)]' : 'hover:bg-[var(--surface)]'}`} style={{ color: 'var(--muted)' }}>No project</button>
                  {projects.map((p) => (
                    <button key={p.id} type="button" onClick={() => h.handleProjectChange(p.id)} className={`w-full px-3 py-2 text-left text-sm transition-colors ${task.projectId === p.id ? 'bg-[var(--neon-dim)]' : 'hover:bg-[var(--surface)]'}`} style={{ color: 'var(--cyan)' }}>{p.name}</button>
                  ))}
                  <div className="px-3 py-2" style={{ borderTop: '1px solid var(--border)' }}>
                    <form onSubmit={(e) => { e.preventDefault(); h.handleCreateProject() }} className="flex gap-1.5">
                      <input type="text" value={h.newProjectName} onChange={(e) => h.setNewProjectName(e.target.value)} placeholder="New project..." className="flex-1 px-2 py-1 rounded text-xs bg-transparent outline-none focus:border-[var(--neon)]" style={{ border: '1px solid var(--border)', color: 'var(--fg)' }} />
                      <button type="submit" disabled={!h.newProjectName.trim()} className="px-2 py-1 rounded text-xs font-medium disabled:opacity-30" style={{ color: 'var(--neon)' }}>+</button>
                    </form>
                  </div>
                </div>
                </>
              )}
            </div>
          </Section>

          {/* Recurrence */}
          <Section label="Repeat">
            <div className="relative">
              <button type="button" onClick={() => h.setShowRecurrencePicker(!h.showRecurrencePicker)}
                className="px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-2"
                style={{ color: task.recurrenceRule ? 'var(--cyan)' : 'var(--muted)', background: task.recurrenceRule ? 'rgba(0, 188, 212, 0.1)' : 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                {task.recurrenceRule ? recurrenceLabel(task.recurrenceRule) : 'No repeat'}
              </button>
              {h.showRecurrencePicker && (
                <RecurrencePicker current={task.recurrenceRule} onChange={h.handleRecurrenceChange} onClose={() => h.setShowRecurrencePicker(false)} />
              )}
            </div>
          </Section>

          {/* Description */}
          <Section label="Description">
            {h.editingField === 'description' ? (
              <textarea ref={descRef} value={h.editDescription} onChange={(e) => h.setEditDescription(e.target.value)}
                onBlur={h.handleSaveDescription}
                onKeyDown={(e) => { if (e.key === 'Escape') { h.setEditDescription(task.description || ''); h.setEditingField(null) } }}
                rows={4} className="w-full px-3 py-2 rounded-lg text-sm bg-transparent resize-none outline-none"
                style={{ border: '1px solid var(--neon)', color: 'var(--fg)' }} placeholder="Add description..."
              />
            ) : (
              <div className="px-3 py-2 rounded-lg text-sm cursor-pointer min-h-[60px] transition-colors hover:bg-[var(--surface)]"
                style={{ color: task.description ? 'var(--fg)' : 'var(--muted)', border: '1px solid var(--border)' }}
                onClick={() => h.setEditingField('description')}
              >
                {task.description || 'Click to add description...'}
              </div>
            )}
          </Section>

          {/* Subtasks */}
          <Section label={`Subtasks${h.subtasks.length > 0 ? ` (${h.doneCount}/${h.subtasks.length})` : ''}`}>
            <SubtaskSection
              subtasks={h.subtasks}
              doneCount={h.doneCount}
              newSubtask={h.newSubtask}
              setNewSubtask={h.setNewSubtask}
              isPending={h.isPending}
              onAddSubtask={h.handleAddSubtask}
              onToggle={h.handleSubtaskToggle}
              onDelete={h.handleSubtaskDelete}
            />
          </Section>

          {/* Delete */}
          <div className="pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            <button type="button" onClick={handleDeleteWithAnimation} className="text-xs transition-colors hover:text-[var(--red)]" style={{ color: 'var(--muted)' }}>
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
