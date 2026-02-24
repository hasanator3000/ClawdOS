'use client'

import { useState, useEffect, useTransition } from 'react'
import type { Task } from '@/lib/db/repositories/task.repository'
import type { RecurrenceRule } from '@/lib/db/repositories/task.repository'
import {
  updateTask,
  completeTask,
  reopenTask,
  createTask,
  deleteTask,
  fetchSubtasks,
  fetchAllTags,
  updateRecurrence,
} from '../actions'
import { createProject as createProjectAction } from '../project-actions'

interface UseTaskDetailHandlersParams {
  task: Task
  onUpdate: (task: Task) => void
  onDelete: (taskId: string) => void
  onClose: () => void
  onProjectsChange?: () => void
}

export function useTaskDetailHandlers({
  task,
  onUpdate,
  onDelete,
  onClose: _onClose,
  onProjectsChange,
}: UseTaskDetailHandlersParams) {
  const [isPending, startTransition] = useTransition()
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

  // Sync edit values when switching tasks
  useEffect(() => {
     
    setEditTitle(task.title)
    setEditDescription(task.description || '')
    setEditingField(null)
    setShowDatePicker(false)
    setSubtasksLoaded(false)
    setSubtasks([])
    setNewTag('')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reset when task.id changes
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

  const doneCount = subtasks.filter((s) => s.status === 'done').length

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
    const updated = { ...task, dueDate: dueDate || null, dueTime: dueTime || null, startDate: startDate || null, startTime: startTime || null }
    onUpdate(updated)
    startTransition(async () => {
      const result = await updateTask(task.id, { dueDate: dueDate || null, dueTime: dueTime || null, startDate: startDate || null, startTime: startTime || null })
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
    onDelete(task.id)
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

  return {
    // State
    isPending,
    editingField,
    setEditingField,
    editTitle,
    setEditTitle,
    editDescription,
    setEditDescription,
    showDatePicker,
    setShowDatePicker,
    subtasks,
    doneCount,
    newSubtask,
    setNewSubtask,
    newTag,
    setNewTag,
    allTags,
    showProjectPicker,
    setShowProjectPicker,
    newProjectName,
    setNewProjectName,
    showRecurrencePicker,
    setShowRecurrencePicker,
    // Handlers
    handleSaveTitle,
    handleSaveDescription,
    handleStatusChange,
    handlePriorityChange,
    handleDateSave,
    handleAddTag,
    handleRemoveTag,
    handleProjectChange,
    handleCreateProject,
    handleRecurrenceChange,
    handleDelete,
    handleAddSubtask,
    handleSubtaskToggle,
    handleSubtaskDelete,
  }
}
