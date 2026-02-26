'use server'

import { getSession } from '@/lib/auth/session'
import { getActiveWorkspace } from '@/lib/workspace'
import { withUser } from '@/lib/db'
import { createLogger } from '@/lib/logger'
import { validateAction } from '@/lib/validation'
import { createTaskSchema, updateTaskSchema, updateTaskDateSchema, updateTaskPrioritySchema, recurrenceRuleSchema, uuidSchema } from '@/lib/validation-schemas'

const log = createLogger('task-actions')
import {
  createTask as createTaskRepo,
  updateTask as updateTaskRepo,
  deleteTask as deleteTaskRepo,
  completeTask as completeTaskRepo,
  reopenTask as reopenTaskRepo,
  getTaskById,
  getSubtasksByParent,
  getUniqueTags,
  type CreateTaskParams,
  type UpdateTaskParams,
  type Task,
  type RecurrenceRule,
} from '@/lib/db/repositories/task.repository'
import { computeNextDate } from '@/lib/recurrence'

export async function createTask(params: Omit<CreateTaskParams, 'workspaceId'>) {
  const session = await getSession()
  if (!session.userId) return { error: 'Unauthorized' }

  const v = validateAction(createTaskSchema, params)
  if (v.error) return { error: v.error }

  const workspace = await getActiveWorkspace()
  if (!workspace) return { error: 'No workspace selected' }

  try {
    const task = await withUser(session.userId, async (client) => {
      return createTaskRepo(client, { ...params, workspaceId: workspace.id })
    })


    return { task }
  } catch (error) {
    log.error('Create task failed', { error: error instanceof Error ? error.message : String(error) })
    return { error: 'Failed to create task' }
  }
}
export async function updateTask(taskId: string, params: UpdateTaskParams) {
  const session = await getSession()
  if (!session.userId) return { error: 'Unauthorized' }

  const idV = validateAction(uuidSchema, taskId)
  if (idV.error) return { error: 'Invalid task ID' }
  const v = validateAction(updateTaskSchema, params)
  if (v.error) return { error: v.error }

  try {
    const task = await withUser(session.userId, async (client) => {
      return updateTaskRepo(client, taskId, params)
    })

    if (!task) {
      return { error: 'Task not found' }
    }
    return { task }
  } catch (error) {
    log.error('Update task failed', { error: error instanceof Error ? error.message : String(error) })
    return { error: 'Failed to update task' }
  }
}

export async function deleteTask(taskId: string) {
  const session = await getSession()
  if (!session.userId) return { error: 'Unauthorized' }
  const idV = validateAction(uuidSchema, taskId)
  if (idV.error) return { error: 'Invalid task ID' }

  try {
    const deleted = await withUser(session.userId, async (client) => {
      return deleteTaskRepo(client, taskId)
    })

    if (!deleted) {
      return { error: 'Task not found' }
    }
    return { success: true }
  } catch (error) {
    log.error('Delete task failed', { error: error instanceof Error ? error.message : String(error) })
    return { error: 'Failed to delete task' }
  }
}

export async function completeTask(taskId: string): Promise<{ task?: Task; nextTask?: Task; error?: string }> {
  const session = await getSession()
  if (!session.userId) return { error: 'Unauthorized' }
  const idV = validateAction(uuidSchema, taskId)
  if (idV.error) return { error: 'Invalid task ID' }

  try {
    const result = await withUser(session.userId, async (client) => {
      const task = await completeTaskRepo(client, taskId)
      if (!task) return { task: null, nextTask: null }

      // REC-02: Auto-create next occurrence for recurring tasks
      let nextTask: Task | null = null
      if (task.recurrenceRule) {
        const nextDueDate = computeNextDate(task.dueDate, task.recurrenceRule)
        // Compute shifted start date if task had a duration
        let nextStartDate: string | undefined
        if (task.startDate && task.dueDate) {
          const oldStart = new Date(task.startDate + 'T00:00')
          const oldDue = new Date(task.dueDate + 'T00:00')
          const durationMs = oldDue.getTime() - oldStart.getTime()
          const newDue = new Date(nextDueDate + 'T00:00')
          const newStart = new Date(newDue.getTime() - durationMs)
          nextStartDate = newStart.toISOString().slice(0, 10)
        }

        nextTask = await createTaskRepo(client, {
          workspaceId: task.workspaceId,
          title: task.title,
          description: task.description || undefined,
          priority: task.priority,
          dueDate: nextDueDate,
          dueTime: task.dueTime || undefined,
          startDate: nextStartDate,
          startTime: task.startTime || undefined,
          tags: task.tags,
          projectId: task.projectId || undefined,
          recurrenceRule: task.recurrenceRule,
        })
      }

      return { task, nextTask }
    })

    if (!result.task) {
      return { error: 'Task not found' }
    }
    return { task: result.task, nextTask: result.nextTask ?? undefined }
  } catch (error) {
    log.error('Complete task failed', { error: error instanceof Error ? error.message : String(error) })
    return { error: 'Failed to complete task' }
  }
}

export async function reopenTask(taskId: string) {
  const session = await getSession()
  if (!session.userId) return { error: 'Unauthorized' }
  const idV = validateAction(uuidSchema, taskId)
  if (idV.error) return { error: 'Invalid task ID' }

  try {
    const task = await withUser(session.userId, async (client) => {
      return reopenTaskRepo(client, taskId)
    })

    if (!task) {
      return { error: 'Task not found' }
    }
    return { task }
  } catch (error) {
    log.error('Reopen task failed', { error: error instanceof Error ? error.message : String(error) })
    return { error: 'Failed to reopen task' }
  }
}

export async function updateTaskPriority(
  taskId: string,
  newPriority: number
): Promise<{ success: boolean; task?: Task; error?: string }> {
  try {
    const session = await getSession()
    if (!session.userId) {
      return { success: false, error: 'Unauthorized' }
    }

    const idV = validateAction(uuidSchema, taskId)
    if (idV.error) return { success: false, error: 'Invalid task ID' }
    const pv = validateAction(updateTaskPrioritySchema, { priority: newPriority })
    if (pv.error) return { success: false, error: pv.error }

    const workspace = await getActiveWorkspace()
    if (!workspace) {
      return { success: false, error: 'No active workspace' }
    }

    const result = await withUser(session.userId, async (client) => {
      // Verify task belongs to current workspace
      const task = await getTaskById(client, taskId)
      if (!task || task.workspaceId !== workspace.id) {
        throw new Error('Task not found or unauthorized')
      }

      // Update priority via repository
      return updateTaskRepo(client, taskId, { priority: newPriority })
    })

    if (!result) {
      return { success: false, error: 'Failed to update task' }
    }
    return { success: true, task: result }
  } catch (err) {
    log.error('updateTaskPriority failed', { error: err instanceof Error ? err.message : String(err) })
    return { success: false, error: 'Server error' }
  }
}

// Optimized action for DnD operations (status, date, startDate changes)
export async function updateTaskDate(
  taskId: string,
  params: {
    dueDate?: string | null
    startDate?: string | null
    status?: 'todo' | 'in_progress' | 'done' | 'cancelled'
  }
): Promise<{ task?: Task; error?: string }> {
  const session = await getSession()
  if (!session.userId) return { error: 'Unauthorized' }
  const idV = validateAction(uuidSchema, taskId)
  if (idV.error) return { error: 'Invalid task ID' }
  const v = validateAction(updateTaskDateSchema, params)
  if (v.error) return { error: v.error }

  try {
    const task = await withUser(session.userId, async (client) => {
      return updateTaskRepo(client, taskId, params)
    })

    if (!task) {
      return { error: 'Task not found' }
    }
    return { task }
  } catch (error) {
    log.error('updateTaskDate failed', { error: error instanceof Error ? error.message : String(error) })
    return { error: 'Failed to update task' }
  }
}

export async function fetchSubtasks(parentId: string): Promise<{ tasks?: Task[]; error?: string }> {
  const session = await getSession()
  if (!session.userId) return { error: 'Unauthorized' }
  const idV = validateAction(uuidSchema, parentId)
  if (idV.error) return { error: 'Invalid parent ID' }

  try {
    const tasks = await withUser(session.userId, async (client) => {
      return getSubtasksByParent(client, parentId)
    })
    return { tasks }
  } catch (error) {
    log.error('fetchSubtasks failed', { error: error instanceof Error ? error.message : String(error) })
    return { error: 'Failed to fetch subtasks' }
  }
}

export async function fetchAllTags(): Promise<{ tags?: string[]; error?: string }> {
  const session = await getSession()
  if (!session.userId) return { error: 'Unauthorized' }

  const workspace = await getActiveWorkspace()
  if (!workspace) return { error: 'No workspace' }

  try {
    const tags = await withUser(session.userId, async (client) => {
      return getUniqueTags(client, workspace.id)
    })
    return { tags }
  } catch (error) {
    log.error('fetchAllTags failed', { error: error instanceof Error ? error.message : String(error) })
    return { error: 'Failed to fetch tags' }
  }
}

export async function updateRecurrence(
  taskId: string,
  rule: RecurrenceRule | null
): Promise<{ task?: Task; error?: string }> {
  const session = await getSession()
  if (!session.userId) return { error: 'Unauthorized' }
  const idV = validateAction(uuidSchema, taskId)
  if (idV.error) return { error: 'Invalid task ID' }
  const rv = validateAction(recurrenceRuleSchema.nullable(), rule)
  if (rv.error) return { error: rv.error }

  try {
    const task = await withUser(session.userId, async (client) => {
      return updateTaskRepo(client, taskId, { recurrenceRule: rule })
    })
    if (!task) return { error: 'Task not found' }

    return { task }
  } catch (error) {
    log.error('updateRecurrence failed', { error: error instanceof Error ? error.message : String(error) })
    return { error: 'Failed to update recurrence' }
  }
}

