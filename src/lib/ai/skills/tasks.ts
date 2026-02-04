import type { Skill, ToolContext, ToolResult } from './registry'
import {
  createTask,
  getTasksByWorkspace,
  getTaskById,
  completeTask,
  reopenTask,
  updateTask,
  deleteTask,
  getOverdueTasks,
} from '@/lib/db/repositories/task.repository'

export const tasksSkill: Skill = {
  id: 'tasks',
  name: 'Task Management',
  description: 'Create, list, and manage tasks',
  tools: [
    {
      name: 'create_task',
      description:
        'Create a new task. Returns the created task with its ID. Use this when the user asks to create, add, or make a new task.',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'The task title (required)',
          },
          description: {
            type: 'string',
            description: 'Optional task description with more details',
          },
          priority: {
            type: 'number',
            description: 'Priority level: 0=none, 1=low, 2=medium, 3=high, 4=urgent',
          },
          due_date: {
            type: 'string',
            description: 'Due date in YYYY-MM-DD format (optional)',
          },
          tags: {
            type: 'array',
            description: 'Tags for categorization',
            items: { type: 'string', description: 'A tag' },
          },
        },
        required: ['title'],
      },
    },
    {
      name: 'list_tasks',
      description:
        'Get a list of tasks. By default returns active (non-completed) tasks. Use this when the user asks "what are my tasks", "show tasks", "list todos", etc.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            description: 'Filter by status: todo, in_progress, done, cancelled. Omit to get active tasks.',
            enum: ['todo', 'in_progress', 'done', 'cancelled'],
          },
          include_completed: {
            type: 'boolean',
            description: 'Whether to include completed tasks (default: false)',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of tasks to return (default: 20)',
          },
        },
      },
    },
    {
      name: 'complete_task',
      description:
        'Mark a task as complete/done. Use this when the user says "complete task", "mark done", "finish task", etc.',
      parameters: {
        type: 'object',
        properties: {
          task_id: {
            type: 'string',
            description: 'The ID of the task to complete',
          },
          task_title: {
            type: 'string',
            description: 'Alternatively, the title of the task to complete (will find first matching)',
          },
        },
      },
    },
    {
      name: 'update_task',
      description: 'Update an existing task. Can change title, description, priority, due date, or status.',
      parameters: {
        type: 'object',
        properties: {
          task_id: {
            type: 'string',
            description: 'The ID of the task to update (required)',
          },
          title: {
            type: 'string',
            description: 'New title',
          },
          description: {
            type: 'string',
            description: 'New description',
          },
          priority: {
            type: 'number',
            description: 'New priority: 0=none, 1=low, 2=medium, 3=high, 4=urgent',
          },
          due_date: {
            type: 'string',
            description: 'New due date in YYYY-MM-DD format (or null to remove)',
          },
          status: {
            type: 'string',
            description: 'New status: todo, in_progress, done, cancelled',
            enum: ['todo', 'in_progress', 'done', 'cancelled'],
          },
        },
        required: ['task_id'],
      },
    },
    {
      name: 'delete_task',
      description: 'Delete a task permanently. Use with caution.',
      parameters: {
        type: 'object',
        properties: {
          task_id: {
            type: 'string',
            description: 'The ID of the task to delete',
          },
        },
        required: ['task_id'],
      },
    },
    {
      name: 'get_overdue_tasks',
      description:
        'Get tasks that are past their due date. Use this when the user asks about overdue or late tasks.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  ],
  handlers: {
    create_task: async (input: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
      const title = String(input.title || '').trim()
      if (!title) {
        return { success: false, error: 'Task title is required' }
      }

      const task = await createTask(context.client, {
        workspaceId: context.workspaceId,
        title,
        description: input.description ? String(input.description) : undefined,
        priority: typeof input.priority === 'number' ? input.priority : 0,
        dueDate: input.due_date ? String(input.due_date) : undefined,
        tags: Array.isArray(input.tags) ? (input.tags as string[]) : undefined,
      })

      return {
        success: true,
        data: {
          message: `Task "${task.title}" created successfully`,
          task: {
            id: task.id,
            title: task.title,
            description: task.description,
            priority: task.priority,
            dueDate: task.dueDate,
            status: task.status,
          },
        },
      }
    },

    list_tasks: async (input: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
      const limit = typeof input.limit === 'number' ? Math.min(input.limit, 50) : 20
      const includeCompleted = input.include_completed === true
      const status = input.status as string | undefined

      const tasks = await getTasksByWorkspace(context.client, context.workspaceId, {
        status,
        limit,
        includeCompleted,
      })

      if (tasks.length === 0) {
        return {
          success: true,
          data: { message: 'No tasks found', count: 0, tasks: [] },
        }
      }

      return {
        success: true,
        data: {
          count: tasks.length,
          tasks: tasks.map((t) => ({
            id: t.id,
            title: t.title,
            description: t.description,
            status: t.status,
            priority: t.priority,
            dueDate: t.dueDate,
            completedAt: t.completedAt,
          })),
        },
      }
    },

    complete_task: async (input: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
      let taskId = input.task_id ? String(input.task_id) : null
      const taskTitle = input.task_title ? String(input.task_title).toLowerCase() : null

      // If no task_id but have title, find the task
      if (!taskId && taskTitle) {
        const tasks = await getTasksByWorkspace(context.client, context.workspaceId, {
          includeCompleted: false,
          limit: 100,
        })
        const match = tasks.find((t) => t.title.toLowerCase().includes(taskTitle))
        if (match) {
          taskId = match.id
        } else {
          return { success: false, error: `No task found matching "${input.task_title}"` }
        }
      }

      if (!taskId) {
        return { success: false, error: 'Task ID or title is required' }
      }

      const task = await completeTask(context.client, taskId)
      if (!task) {
        return { success: false, error: 'Task not found' }
      }

      return {
        success: true,
        data: {
          message: `Task "${task.title}" marked as complete`,
          task: {
            id: task.id,
            title: task.title,
            status: task.status,
            completedAt: task.completedAt,
          },
        },
      }
    },

    update_task: async (input: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
      const taskId = input.task_id ? String(input.task_id) : null
      if (!taskId) {
        return { success: false, error: 'Task ID is required' }
      }

      const updates: Record<string, unknown> = {}
      if (input.title !== undefined) updates.title = String(input.title)
      if (input.description !== undefined) updates.description = String(input.description)
      if (input.priority !== undefined) updates.priority = Number(input.priority)
      if (input.due_date !== undefined) updates.dueDate = input.due_date ? String(input.due_date) : null
      if (input.status !== undefined) updates.status = String(input.status)

      const task = await updateTask(context.client, taskId, updates)
      if (!task) {
        return { success: false, error: 'Task not found' }
      }

      return {
        success: true,
        data: {
          message: `Task "${task.title}" updated`,
          task: {
            id: task.id,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            dueDate: task.dueDate,
          },
        },
      }
    },

    delete_task: async (input: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
      const taskId = input.task_id ? String(input.task_id) : null
      if (!taskId) {
        return { success: false, error: 'Task ID is required' }
      }

      // Get task first for confirmation message
      const task = await getTaskById(context.client, taskId)
      if (!task) {
        return { success: false, error: 'Task not found' }
      }

      const deleted = await deleteTask(context.client, taskId)
      if (!deleted) {
        return { success: false, error: 'Failed to delete task' }
      }

      return {
        success: true,
        data: {
          message: `Task "${task.title}" deleted`,
        },
      }
    },

    get_overdue_tasks: async (_input: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
      const tasks = await getOverdueTasks(context.client, context.workspaceId)

      if (tasks.length === 0) {
        return {
          success: true,
          data: { message: 'No overdue tasks', count: 0, tasks: [] },
        }
      }

      return {
        success: true,
        data: {
          count: tasks.length,
          tasks: tasks.map((t) => ({
            id: t.id,
            title: t.title,
            dueDate: t.dueDate,
            priority: t.priority,
            status: t.status,
          })),
        },
      }
    },
  },
}
