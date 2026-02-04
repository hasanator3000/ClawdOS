import type { PoolClient } from 'pg'

export interface Entity {
  id: string
  workspaceId: string
  type: string
  slug: string | null
  title: string | null
  content: string | null
  data: Record<string, unknown>
  tags: string[]
  createdAt: Date
  updatedAt: Date
  createdBy: string | null
}

export interface EntityLink {
  id: string
  workspaceId: string
  sourceId: string
  targetId: string
  relation: string
  data: Record<string, unknown>
  createdAt: Date
  createdBy: string | null
}

export interface CreateEntityParams {
  workspaceId: string
  type: string
  slug?: string
  title?: string
  content?: string
  data?: Record<string, unknown>
  tags?: string[]
}

export interface UpdateEntityParams {
  title?: string
  content?: string
  data?: Record<string, unknown>
  tags?: string[]
}

export async function createEntity(client: PoolClient, params: CreateEntityParams): Promise<Entity> {
  const { workspaceId, type, slug, title, content, data, tags } = params

  const result = await client.query(
    `insert into core.entity (workspace_id, type, slug, title, content, data, tags, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, core.current_user_id())
     returning
       id,
       workspace_id as "workspaceId",
       type,
       slug,
       title,
       content,
       data,
       tags,
       created_at as "createdAt",
       updated_at as "updatedAt",
       created_by as "createdBy"`,
    [
      workspaceId,
      type,
      slug || null,
      title || null,
      content || null,
      JSON.stringify(data || {}),
      tags || [],
    ]
  )

  return result.rows[0] as Entity
}

export async function updateEntity(
  client: PoolClient,
  entityId: string,
  params: UpdateEntityParams
): Promise<Entity | null> {
  const updates: string[] = ['updated_at = now()']
  const values: unknown[] = []
  let paramIndex = 1

  if (params.title !== undefined) {
    updates.push(`title = $${paramIndex++}`)
    values.push(params.title)
  }
  if (params.content !== undefined) {
    updates.push(`content = $${paramIndex++}`)
    values.push(params.content)
  }
  if (params.data !== undefined) {
    updates.push(`data = $${paramIndex++}`)
    values.push(JSON.stringify(params.data))
  }
  if (params.tags !== undefined) {
    updates.push(`tags = $${paramIndex++}`)
    values.push(params.tags)
  }

  values.push(entityId)

  const result = await client.query(
    `update core.entity
     set ${updates.join(', ')}
     where id = $${paramIndex}
     returning
       id,
       workspace_id as "workspaceId",
       type,
       slug,
       title,
       content,
       data,
       tags,
       created_at as "createdAt",
       updated_at as "updatedAt",
       created_by as "createdBy"`,
    values
  )

  return (result.rows[0] as Entity) || null
}

export async function deleteEntity(client: PoolClient, entityId: string): Promise<boolean> {
  const result = await client.query('delete from core.entity where id = $1', [entityId])
  return (result.rowCount ?? 0) > 0
}

export async function getEntityById(client: PoolClient, entityId: string): Promise<Entity | null> {
  const result = await client.query(
    `select
       id,
       workspace_id as "workspaceId",
       type,
       slug,
       title,
       content,
       data,
       tags,
       created_at as "createdAt",
       updated_at as "updatedAt",
       created_by as "createdBy"
     from core.entity
     where id = $1`,
    [entityId]
  )

  return (result.rows[0] as Entity) || null
}

export async function getEntitiesByType(
  client: PoolClient,
  workspaceId: string,
  type: string
): Promise<Entity[]> {
  const result = await client.query(
    `select
       id,
       workspace_id as "workspaceId",
       type,
       slug,
       title,
       content,
       data,
       tags,
       created_at as "createdAt",
       updated_at as "updatedAt",
       created_by as "createdBy"
     from core.entity
     where workspace_id = $1 and type = $2
     order by created_at desc`,
    [workspaceId, type]
  )

  return result.rows as Entity[]
}

export async function getEntitiesByTags(
  client: PoolClient,
  workspaceId: string,
  tags: string[]
): Promise<Entity[]> {
  const result = await client.query(
    `select
       id,
       workspace_id as "workspaceId",
       type,
       slug,
       title,
       content,
       data,
       tags,
       created_at as "createdAt",
       updated_at as "updatedAt",
       created_by as "createdBy"
     from core.entity
     where workspace_id = $1 and tags && $2
     order by created_at desc`,
    [workspaceId, tags]
  )

  return result.rows as Entity[]
}

// Entity Links

export async function createEntityLink(
  client: PoolClient,
  workspaceId: string,
  sourceId: string,
  targetId: string,
  relation: string,
  data?: Record<string, unknown>
): Promise<EntityLink> {
  const result = await client.query(
    `insert into core.entity_link (workspace_id, source_id, target_id, relation, data, created_by)
     values ($1, $2, $3, $4, $5, core.current_user_id())
     returning
       id,
       workspace_id as "workspaceId",
       source_id as "sourceId",
       target_id as "targetId",
       relation,
       data,
       created_at as "createdAt",
       created_by as "createdBy"`,
    [workspaceId, sourceId, targetId, relation, JSON.stringify(data || {})]
  )

  return result.rows[0] as EntityLink
}

export async function deleteEntityLink(
  client: PoolClient,
  sourceId: string,
  targetId: string,
  relation: string
): Promise<boolean> {
  const result = await client.query(
    'delete from core.entity_link where source_id = $1 and target_id = $2 and relation = $3',
    [sourceId, targetId, relation]
  )
  return (result.rowCount ?? 0) > 0
}

export async function getEntityLinks(
  client: PoolClient,
  entityId: string,
  direction: 'outgoing' | 'incoming' | 'both' = 'both'
): Promise<EntityLink[]> {
  let whereClause = ''
  if (direction === 'outgoing') {
    whereClause = 'where source_id = $1'
  } else if (direction === 'incoming') {
    whereClause = 'where target_id = $1'
  } else {
    whereClause = 'where source_id = $1 or target_id = $1'
  }

  const result = await client.query(
    `select
       id,
       workspace_id as "workspaceId",
       source_id as "sourceId",
       target_id as "targetId",
       relation,
       data,
       created_at as "createdAt",
       created_by as "createdBy"
     from core.entity_link
     ${whereClause}
     order by created_at desc`,
    [entityId]
  )

  return result.rows as EntityLink[]
}
