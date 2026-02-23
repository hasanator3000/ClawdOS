'use server'

import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth/session'
import { getActiveWorkspace } from '@/lib/workspace'
import { withUser } from '@/lib/db'
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
} from '@/lib/db/repositories/task.repository'

export async function createTask(params: Omit<CreateTaskParams, 'workspaceId'>) {
  const session = await getSession()
  if (!session.userId) {
    return { error: 'Unauthorized' }
  }

  const workspace = await getActiveWorkspace()
  if (!workspace) {
    return { error: 'No workspace selected' }
  }

  try {
    const task = await withUser(session.userId, async (client) => {
      return createTaskRepo(client, {
        ...params,
        workspaceId: workspace.id,
      })
    })

    revalidatePath('/tasks')
    return { task }
  } catch (error) {
    console.error('Create task error:', error)
    return { error: 'Failed to create task' }
  }
}

export async function updateTask(taskId: string, params: UpdateTaskParams) {
  const session = await getSession()
  if (!session.userId) {
    return { error: 'Unauthorized' }
  }

  try {
    const task = await withUser(session.userId, async (client) => {
      return updateTaskRepo(client, taskId, params)
    })

    if (!task) {
      return { error: 'Task not found' }
    }

    revalidatePath('/tasks')
    return { task }
  } catch (error) {
    console.error('Update task error:', error)
    return { error: 'Failed to update task' }
  }
}

export async function deleteTask(taskId: string) {
  const session = await getSession()
  if (!session.userId) {
    return { error: 'Unauthorized' }
  }

  try {
    const deleted = await withUser(session.userId, async (client) => {
      return deleteTaskRepo(client, taskId)
    })

    if (!deleted) {
      return { error: 'Task not found' }
    }

    revalidatePath('/tasks')
    return { success: true }
  } catch (error) {
    console.error('Delete task error:', error)
    return { error: 'Failed to delete task' }
  }
}

export async function completeTask(taskId: string) {
  const session = await getSession()
  if (!session.userId) {
    return { error: 'Unauthorized' }
  }

  try {
    const task = await withUser(session.userId, async (client) => {
      return completeTaskRepo(client, taskId)
    })

    if (!task) {
      return { error: 'Task not found' }
    }

    revalidatePath('/tasks')
    return { task }
  } catch (error) {
    console.error('Complete task error:', error)
    return { error: 'Failed to complete task' }
  }
}

export async function reopenTask(taskId: string) {
  const session = await getSession()
  if (!session.userId) {
    return { error: 'Unauthorized' }
  }

  try {
    const task = await withUser(session.userId, async (client) => {
      return reopenTaskRepo(client, taskId)
    })

    if (!task) {
      return { error: 'Task not found' }
    }

    revalidatePath('/tasks')
    return { task }
  } catch (error) {
    console.error('Reopen task error:', error)
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

    const workspace = await getActiveWorkspace()
    if (!workspace) {
      return { success: false, error: 'No active workspace' }
    }

    // Validate priority is in valid range (0-4)
    if (!Number.isInteger(newPriority) || newPriority < 0 || newPriority > 4) {
      return { success: false, error: 'Invalid priority value' }
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

    revalidatePath('/tasks')
    return { success: true, task: result }
  } catch (err) {
    console.error('updateTaskPriority error:', err)
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
  if (!session.userId) {
    return { error: 'Unauthorized' }
  }

  try {
    const task = await withUser(session.userId, async (client) => {
      return updateTaskRepo(client, taskId, params)
    })

    if (!task) {
      return { error: 'Task not found' }
    }

    revalidatePath('/tasks')
    return { task }
  } catch (error) {
    console.error('updateTaskDate error:', error)
    return { error: 'Failed to update task' }
  }
}

export async function fetchSubtasks(parentId: string): Promise<{ tasks?: Task[]; error?: string }> {
  const session = await getSession()
  if (!session.userId) {
    return { error: 'Unauthorized' }
  }

  try {
    const tasks = await withUser(session.userId, async (client) => {
      return getSubtasksByParent(client, parentId)
    })
    return { tasks }
  } catch (error) {
    console.error('fetchSubtasks error:', error)
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
    console.error('fetchAllTags error:', error)
    return { error: 'Failed to fetch tags' }
  }
}
