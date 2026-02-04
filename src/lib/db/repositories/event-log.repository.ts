import type { PoolClient } from 'pg'

export interface EventLogEntry {
  id: string
  workspaceId: string
  userId: string | null
  entityType: string
  entityId: string
  action: 'create' | 'update' | 'delete'
  revision: number
  changes: Record<string, unknown> | null
  createdAt: Date
}

export interface CreateEventLogParams {
  workspaceId: string
  entityType: string
  entityId: string
  action: 'create' | 'update' | 'delete'
  changes?: Record<string, unknown>
}

export async function createEventLogEntry(
  client: PoolClient,
  params: CreateEventLogParams
): Promise<EventLogEntry> {
  const { workspaceId, entityType, entityId, action, changes } = params

  // Get next revision for this entity
  const revisionResult = await client.query(
    `select coalesce(max(revision), 0) + 1 as next_revision
     from core.event_log
     where entity_type = $1 and entity_id = $2`,
    [entityType, entityId]
  )
  const revision = revisionResult.rows[0].next_revision

  const result = await client.query(
    `insert into core.event_log (workspace_id, user_id, entity_type, entity_id, action, revision, changes)
     values ($1, core.current_user_id(), $2, $3, $4, $5, $6)
     returning
       id,
       workspace_id as "workspaceId",
       user_id as "userId",
       entity_type as "entityType",
       entity_id as "entityId",
       action,
       revision,
       changes,
       created_at as "createdAt"`,
    [workspaceId, entityType, entityId, action, revision, changes ? JSON.stringify(changes) : null]
  )

  return result.rows[0] as EventLogEntry
}

export async function getEventsByEntity(
  client: PoolClient,
  entityType: string,
  entityId: string
): Promise<EventLogEntry[]> {
  const result = await client.query(
    `select
       id,
       workspace_id as "workspaceId",
       user_id as "userId",
       entity_type as "entityType",
       entity_id as "entityId",
       action,
       revision,
       changes,
       created_at as "createdAt"
     from core.event_log
     where entity_type = $1 and entity_id = $2
     order by revision asc`,
    [entityType, entityId]
  )

  return result.rows as EventLogEntry[]
}

export async function getRecentEvents(
  client: PoolClient,
  workspaceId: string,
  limit = 50
): Promise<EventLogEntry[]> {
  const result = await client.query(
    `select
       id,
       workspace_id as "workspaceId",
       user_id as "userId",
       entity_type as "entityType",
       entity_id as "entityId",
       action,
       revision,
       changes,
       created_at as "createdAt"
     from core.event_log
     where workspace_id = $1
     order by created_at desc
     limit $2`,
    [workspaceId, limit]
  )

  return result.rows as EventLogEntry[]
}
