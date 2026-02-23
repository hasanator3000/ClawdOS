import type { PoolClient } from 'pg'
import { getPool } from '@/lib/db'
import type { Conversation } from './types'

export async function createConversation(
  client: PoolClient,
  params: {
    workspaceId: string
    title?: string
    context?: Record<string, unknown>
  }
): Promise<Conversation> {
  const { workspaceId, title, context } = params

  const result = await client.query(
    `insert into core.conversation (workspace_id, user_id, title, context)
     values ($1, core.current_user_id(), $2, $3)
     returning
       id,
       workspace_id as "workspaceId",
       user_id as "userId",
       title,
       context,
       status,
       created_at as "createdAt",
       updated_at as "updatedAt"`,
    [workspaceId, title || null, JSON.stringify(context || {})]
  )

  return result.rows[0] as Conversation
}

export async function getConversationById(
  client: PoolClient,
  conversationId: string
): Promise<Conversation | null> {
  const result = await client.query(
    `select
       id,
       workspace_id as "workspaceId",
       user_id as "userId",
       title,
       context,
       status,
       created_at as "createdAt",
       updated_at as "updatedAt"
     from core.conversation
     where id = $1`,
    [conversationId]
  )

  return (result.rows[0] as Conversation) || null
}

export async function getConversations(
  client: PoolClient,
  workspaceId: string,
  limit = 50
): Promise<Conversation[]> {
  const result = await client.query(
    `select
       id,
       workspace_id as "workspaceId",
       user_id as "userId",
       title,
       context,
       status,
       created_at as "createdAt",
       updated_at as "updatedAt"
     from core.conversation
     where workspace_id = $1 and status = 'active'
     order by updated_at desc
     limit $2`,
    [workspaceId, limit]
  )

  return result.rows as Conversation[]
}

export async function updateConversation(
  client: PoolClient,
  conversationId: string,
  params: { title?: string; context?: Record<string, unknown>; status?: 'active' | 'archived' }
): Promise<Conversation | null> {
  const updates: string[] = ['updated_at = now()']
  const values: unknown[] = []
  let paramIndex = 1

  if (params.title !== undefined) {
    updates.push(`title = $${paramIndex++}`)
    values.push(params.title)
  }
  if (params.context !== undefined) {
    updates.push(`context = $${paramIndex++}`)
    values.push(JSON.stringify(params.context))
  }
  if (params.status !== undefined) {
    updates.push(`status = $${paramIndex++}`)
    values.push(params.status)
  }

  values.push(conversationId)

  const result = await client.query(
    `update core.conversation
     set ${updates.join(', ')}
     where id = $${paramIndex}
     returning
       id,
       workspace_id as "workspaceId",
       user_id as "userId",
       title,
       context,
       status,
       created_at as "createdAt",
       updated_at as "updatedAt"`,
    values
  )

  return (result.rows[0] as Conversation) || null
}

export async function deleteConversation(client: PoolClient, conversationId: string): Promise<boolean> {
  const result = await client.query('delete from core.conversation where id = $1', [conversationId])
  return (result.rowCount ?? 0) > 0
}

export async function getActiveConversation(
  workspaceId: string,
  userId: string
): Promise<Conversation | null> {
  const pool = getPool()
  const result = await pool.query(
    `select
       id,
       workspace_id as "workspaceId",
       user_id as "userId",
       title,
       context,
       status,
       created_at as "createdAt",
       updated_at as "updatedAt"
     from core.conversation
     where workspace_id = $1 and user_id = $2 and status = 'active'
     order by updated_at desc
     limit 1`,
    [workspaceId, userId]
  )

  return (result.rows[0] as Conversation) || null
}
