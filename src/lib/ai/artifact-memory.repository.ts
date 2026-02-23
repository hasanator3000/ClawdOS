import type { PoolClient } from 'pg'
import type { Artifact, Memory } from './types'

// ==========================================================================
// Artifact Repository
// ==========================================================================

export async function createArtifact(
  client: PoolClient,
  params: {
    conversationId: string
    messageId?: string
    type: 'code' | 'document' | 'image' | 'data'
    title?: string
    content: string
    language?: string
    mimeType?: string
  }
): Promise<Artifact> {
  const { conversationId, messageId, type, title, content, language, mimeType } = params

  const result = await client.query(
    `insert into core.artifact (conversation_id, message_id, type, title, content, language, mime_type)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning
       id,
       conversation_id as "conversationId",
       message_id as "messageId",
       type,
       title,
       content,
       language,
       mime_type as "mimeType",
       version,
       created_at as "createdAt"`,
    [conversationId, messageId || null, type, title || null, content, language || null, mimeType || null]
  )

  return result.rows[0] as Artifact
}

export async function getArtifactsByConversation(
  client: PoolClient,
  conversationId: string
): Promise<Artifact[]> {
  const result = await client.query(
    `select
       id,
       conversation_id as "conversationId",
       message_id as "messageId",
       type,
       title,
       content,
       language,
       mime_type as "mimeType",
       version,
       created_at as "createdAt"
     from core.artifact
     where conversation_id = $1
     order by created_at asc`,
    [conversationId]
  )

  return result.rows as Artifact[]
}

// ==========================================================================
// Memory Repository
// ==========================================================================

export async function createMemory(
  client: PoolClient,
  params: {
    workspaceId: string
    type: 'fact' | 'preference' | 'instruction' | 'entity'
    content: string
    sourceConversationId?: string
    sourceMessageId?: string
    importance?: number
  }
): Promise<Memory> {
  const { workspaceId, type, content, sourceConversationId, sourceMessageId, importance } = params

  const result = await client.query(
    `insert into core.memory (workspace_id, type, content, source_conversation_id, source_message_id, importance)
     values ($1, $2, $3, $4, $5, $6)
     returning
       id,
       workspace_id as "workspaceId",
       type,
       content,
       source_conversation_id as "sourceConversationId",
       source_message_id as "sourceMessageId",
       importance,
       access_count as "accessCount",
       last_accessed as "lastAccessed",
       created_at as "createdAt",
       updated_at as "updatedAt"`,
    [
      workspaceId,
      type,
      content,
      sourceConversationId || null,
      sourceMessageId || null,
      importance ?? 0.5,
    ]
  )

  return result.rows[0] as Memory
}

export async function getMemories(
  client: PoolClient,
  workspaceId: string,
  type?: string,
  limit = 100
): Promise<Memory[]> {
  const result = await client.query(
    `select
       id,
       workspace_id as "workspaceId",
       type,
       content,
       source_conversation_id as "sourceConversationId",
       source_message_id as "sourceMessageId",
       importance,
       access_count as "accessCount",
       last_accessed as "lastAccessed",
       created_at as "createdAt",
       updated_at as "updatedAt"
     from core.memory
     where workspace_id = $1 ${type ? 'and type = $3' : ''}
     order by importance desc, updated_at desc
     limit $2`,
    type ? [workspaceId, limit, type] : [workspaceId, limit]
  )

  return result.rows as Memory[]
}

export async function accessMemory(client: PoolClient, memoryId: string): Promise<void> {
  await client.query(
    `update core.memory
     set access_count = access_count + 1, last_accessed = now()
     where id = $1`,
    [memoryId]
  )
}

export async function deleteMemory(client: PoolClient, memoryId: string): Promise<boolean> {
  const result = await client.query('delete from core.memory where id = $1', [memoryId])
  return (result.rowCount ?? 0) > 0
}
