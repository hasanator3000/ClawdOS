import type { PoolClient } from 'pg'

// 1. Entity type — matches DB columns in camelCase
export interface Process {
  id: string
  workspaceId: string
  title: string
  description: string | null
  schedule: string
  actionType: string
  actionConfig: Record<string, unknown>
  enabled: boolean
  lastRunAt: Date | null
  nextRunAt: Date | null
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
}

// 2. Create params — only writable fields
export interface CreateProcessParams {
  workspaceId: string
  title: string
  description?: string
  schedule: string
  actionType: string
  actionConfig?: Record<string, unknown>
}

// 3. Update params — all optional
export interface UpdateProcessParams {
  title?: string
  description?: string
  schedule?: string
  actionType?: string
  actionConfig?: Record<string, unknown>
  enabled?: boolean
}

// 4. CRUD functions — all accept PoolClient as first arg

export async function createProcess(
  client: PoolClient,
  params: CreateProcessParams
): Promise<Process> {
  const result = await client.query(
    `insert into content.processes (
       workspace_id, title, description, schedule, action_type, action_config, created_by
     )
     values ($1, $2, $3, $4, $5, $6, core.current_user_id())
     returning
       id,
       workspace_id as "workspaceId",
       title,
       description,
       schedule,
       action_type as "actionType",
       action_config as "actionConfig",
       enabled,
       last_run_at as "lastRunAt",
       next_run_at as "nextRunAt",
       created_by as "createdBy",
       created_at as "createdAt",
       updated_at as "updatedAt"`,
    [
      params.workspaceId,
      params.title,
      params.description || null,
      params.schedule,
      params.actionType,
      params.actionConfig || {},
    ]
  )

  return result.rows[0] as Process
}

export async function findProcessesByWorkspace(
  client: PoolClient,
  workspaceId: string
): Promise<Process[]> {
  const result = await client.query(
    `select
       id,
       workspace_id as "workspaceId",
       title,
       description,
       schedule,
       action_type as "actionType",
       action_config as "actionConfig",
       enabled,
       last_run_at as "lastRunAt",
       next_run_at as "nextRunAt",
       created_by as "createdBy",
       created_at as "createdAt",
       updated_at as "updatedAt"
     from content.processes
     where workspace_id = $1
     order by created_at desc`,
    [workspaceId]
  )

  return result.rows as Process[]
}

export async function findProcessById(
  client: PoolClient,
  id: string
): Promise<Process | null> {
  const result = await client.query(
    `select
       id,
       workspace_id as "workspaceId",
       title,
       description,
       schedule,
       action_type as "actionType",
       action_config as "actionConfig",
       enabled,
       last_run_at as "lastRunAt",
       next_run_at as "nextRunAt",
       created_by as "createdBy",
       created_at as "createdAt",
       updated_at as "updatedAt"
     from content.processes
     where id = $1`,
    [id]
  )

  return (result.rows[0] as Process) || null
}

export async function updateProcess(
  client: PoolClient,
  id: string,
  params: UpdateProcessParams
): Promise<Process | null> {
  // Dynamic SET — only update provided fields
  const sets: string[] = []
  const vals: unknown[] = []
  let idx = 1

  if (params.title !== undefined) {
    sets.push(`title = $${idx++}`)
    vals.push(params.title)
  }
  if (params.description !== undefined) {
    sets.push(`description = $${idx++}`)
    vals.push(params.description)
  }
  if (params.schedule !== undefined) {
    sets.push(`schedule = $${idx++}`)
    vals.push(params.schedule)
  }
  if (params.actionType !== undefined) {
    sets.push(`action_type = $${idx++}`)
    vals.push(params.actionType)
  }
  if (params.actionConfig !== undefined) {
    sets.push(`action_config = $${idx++}`)
    vals.push(params.actionConfig)
  }
  if (params.enabled !== undefined) {
    sets.push(`enabled = $${idx++}`)
    vals.push(params.enabled)
  }

  sets.push(`updated_at = now()`)
  vals.push(id)

  const result = await client.query(
    `update content.processes
     set ${sets.join(', ')}
     where id = $${idx}
     returning
       id,
       workspace_id as "workspaceId",
       title,
       description,
       schedule,
       action_type as "actionType",
       action_config as "actionConfig",
       enabled,
       last_run_at as "lastRunAt",
       next_run_at as "nextRunAt",
       created_by as "createdBy",
       created_at as "createdAt",
       updated_at as "updatedAt"`,
    vals
  )

  return (result.rows[0] as Process) || null
}

export async function toggleProcess(
  client: PoolClient,
  id: string
): Promise<Process | null> {
  const result = await client.query(
    `update content.processes
     set enabled = not enabled, updated_at = now()
     where id = $1
     returning
       id,
       workspace_id as "workspaceId",
       title,
       description,
       schedule,
       action_type as "actionType",
       action_config as "actionConfig",
       enabled,
       last_run_at as "lastRunAt",
       next_run_at as "nextRunAt",
       created_by as "createdBy",
       created_at as "createdAt",
       updated_at as "updatedAt"`,
    [id]
  )

  return (result.rows[0] as Process) || null
}

export async function deleteProcess(client: PoolClient, id: string): Promise<boolean> {
  const result = await client.query('delete from content.processes where id = $1', [id])
  return (result.rowCount ?? 0) > 0
}
