import type { PoolClient } from 'pg'

export type RecurrenceType = 'daily' | 'weekly' | 'monthly' | 'custom'

export interface RecurrenceRule {
  type: RecurrenceType
  interval: number       // every N (days/weeks/months)
  weekdays?: number[]    // for 'custom': 0=Sun, 1=Mon … 6=Sat
}

export interface Task {
  id: string
  workspaceId: string
  parentId: string | null
  title: string
  description: string | null
  status: 'todo' | 'in_progress' | 'done' | 'cancelled'
  priority: number
  startDate: string | null
  startTime: string | null
  dueDate: string | null
  dueTime: string | null
  tags: string[]
  projectId: string | null
  assigneeId: string | null
  recurrenceRule: RecurrenceRule | null
  createdAt: Date
  updatedAt: Date
  completedAt: Date | null
  createdBy: string | null
}

export interface CreateTaskParams {
  workspaceId: string
  title: string
  description?: string
  status?: 'todo' | 'in_progress' | 'done' | 'cancelled'
  priority?: number
  startDate?: string
  startTime?: string
  dueDate?: string
  dueTime?: string
  tags?: string[]
  parentId?: string
  projectId?: string
  assigneeId?: string
  recurrenceRule?: RecurrenceRule | null
}

export interface UpdateTaskParams {
  title?: string
  description?: string
  status?: 'todo' | 'in_progress' | 'done' | 'cancelled'
  priority?: number
  startDate?: string | null
  startTime?: string | null
  dueDate?: string | null
  dueTime?: string | null
  tags?: string[]
  parentId?: string | null
  projectId?: string | null
  assigneeId?: string | null
  recurrenceRule?: RecurrenceRule | null
}

// Shared SELECT column list
const TASK_COLS = `
  id, workspace_id as "workspaceId", parent_id as "parentId",
  title, description, status, priority,
  start_date as "startDate", start_time as "startTime",
  due_date as "dueDate", due_time as "dueTime",
  tags, project_id as "projectId", assignee_id as "assigneeId",
  recurrence_rule as "recurrenceRule",
  created_at as "createdAt", updated_at as "updatedAt",
  completed_at as "completedAt", created_by as "createdBy"`

export async function createTask(client: PoolClient, params: CreateTaskParams): Promise<Task> {
  const {
    workspaceId, title, description, status = 'todo', priority = 0,
    startDate, startTime, dueDate, dueTime,
    tags = [], parentId, projectId, assigneeId, recurrenceRule,
  } = params

  const result = await client.query(
    `insert into core.task (
       workspace_id, title, description, status, priority,
       start_date, start_time, due_date, due_time,
       tags, parent_id, project_id, assignee_id, recurrence_rule, created_by
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, core.current_user_id())
     returning ${TASK_COLS}`,
    [
      workspaceId, title, description || null, status, priority,
      startDate || null, startTime || null, dueDate || null, dueTime || null,
      tags, parentId || null, projectId || null, assigneeId || null,
      recurrenceRule ? JSON.stringify(recurrenceRule) : null,
    ]
  )

  return result.rows[0] as Task
}

export async function updateTask(
  client: PoolClient,
  taskId: string,
  params: UpdateTaskParams
): Promise<Task | null> {
  const updates: string[] = ['updated_at = now()']
  const values: unknown[] = []
  let paramIndex = 1

  if (params.title !== undefined) {
    updates.push(`title = $${paramIndex++}`)
    values.push(params.title)
  }
  if (params.description !== undefined) {
    updates.push(`description = $${paramIndex++}`)
    values.push(params.description)
  }
  if (params.status !== undefined) {
    updates.push(`status = $${paramIndex++}`)
    values.push(params.status)
    if (params.status === 'done') {
      updates.push('completed_at = now()')
    } else if (params.status === 'todo' || params.status === 'in_progress') {
      updates.push('completed_at = null')
    }
  }
  if (params.priority !== undefined) {
    updates.push(`priority = $${paramIndex++}`)
    values.push(params.priority)
  }
  if (params.startDate !== undefined) {
    updates.push(`start_date = $${paramIndex++}`)
    values.push(params.startDate)
  }
  if (params.startTime !== undefined) {
    updates.push(`start_time = $${paramIndex++}`)
    values.push(params.startTime)
  }
  if (params.dueDate !== undefined) {
    updates.push(`due_date = $${paramIndex++}`)
    values.push(params.dueDate)
  }
  if (params.dueTime !== undefined) {
    updates.push(`due_time = $${paramIndex++}`)
    values.push(params.dueTime)
  }
  if (params.tags !== undefined) {
    updates.push(`tags = $${paramIndex++}`)
    values.push(params.tags)
  }
  if (params.parentId !== undefined) {
    updates.push(`parent_id = $${paramIndex++}`)
    values.push(params.parentId)
  }
  if (params.projectId !== undefined) {
    updates.push(`project_id = $${paramIndex++}`)
    values.push(params.projectId)
  }
  if (params.assigneeId !== undefined) {
    updates.push(`assignee_id = $${paramIndex++}`)
    values.push(params.assigneeId)
  }
  if (params.recurrenceRule !== undefined) {
    updates.push(`recurrence_rule = $${paramIndex++}`)
    values.push(params.recurrenceRule ? JSON.stringify(params.recurrenceRule) : null)
  }

  values.push(taskId)

  const result = await client.query(
    `update core.task set ${updates.join(', ')} where id = $${paramIndex}
     returning ${TASK_COLS}`,
    values
  )

  return (result.rows[0] as Task) || null
}

export async function deleteTask(client: PoolClient, taskId: string): Promise<boolean> {
  const result = await client.query('delete from core.task where id = $1', [taskId])
  return (result.rowCount ?? 0) > 0
}

export async function getTaskById(client: PoolClient, taskId: string): Promise<Task | null> {
  const result = await client.query(
    `select ${TASK_COLS} from core.task where id = $1`,
    [taskId]
  )
  return (result.rows[0] as Task) || null
}

export async function getTasksByWorkspace(
  client: PoolClient,
  workspaceId: string,
  options: {
    status?: string | string[]
    limit?: number
    includeCompleted?: boolean
  } = {}
): Promise<Task[]> {
  const { status, limit = 100, includeCompleted = false } = options

  let whereClause = 'where workspace_id = $1'
  const values: unknown[] = [workspaceId]

  if (status) {
    if (Array.isArray(status)) {
      whereClause += ` and status = any($2)`
      values.push(status)
    } else {
      whereClause += ` and status = $2`
      values.push(status)
    }
  } else if (!includeCompleted) {
    whereClause += ` and status not in ('done', 'cancelled')`
  }

  const result = await client.query(
    `select ${TASK_COLS} from core.task
     ${whereClause}
     order by
       case status when 'in_progress' then 0 when 'todo' then 1 when 'done' then 2 when 'cancelled' then 3 end,
       priority desc, due_date asc nulls last, created_at desc
     limit $${values.length + 1}`,
    [...values, limit]
  )

  return result.rows as Task[]
}

export async function completeTask(client: PoolClient, taskId: string): Promise<Task | null> {
  return updateTask(client, taskId, { status: 'done' })
}

export async function reopenTask(client: PoolClient, taskId: string): Promise<Task | null> {
  return updateTask(client, taskId, { status: 'todo' })
}

export async function getTasksByTags(
  client: PoolClient,
  workspaceId: string,
  tags: string[]
): Promise<Task[]> {
  const result = await client.query(
    `select ${TASK_COLS} from core.task
     where workspace_id = $1 and tags && $2
     order by priority desc, created_at desc`,
    [workspaceId, tags]
  )
  return result.rows as Task[]
}

export async function getSubtasksByParent(client: PoolClient, parentId: string): Promise<Task[]> {
  const result = await client.query(
    `select ${TASK_COLS} from core.task
     where parent_id = $1
     order by
       case status when 'in_progress' then 0 when 'todo' then 1 when 'done' then 2 when 'cancelled' then 3 end,
       priority desc, created_at desc`,
    [parentId]
  )
  return result.rows as Task[]
}

export async function getUniqueTags(client: PoolClient, workspaceId: string): Promise<string[]> {
  const result = await client.query(
    `select distinct unnest(tags) as tag from core.task
     where workspace_id = $1 and array_length(tags, 1) > 0
     order by tag`,
    [workspaceId]
  )
  return result.rows.map((r: { tag: string }) => r.tag)
}

export async function getOverdueTasks(client: PoolClient, workspaceId: string): Promise<Task[]> {
  const result = await client.query(
    `select ${TASK_COLS} from core.task
     where workspace_id = $1
       and status not in ('done', 'cancelled')
       and due_date < current_date
     order by due_date asc, priority desc`,
    [workspaceId]
  )
  return result.rows as Task[]
}
