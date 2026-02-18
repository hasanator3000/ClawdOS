import type { PoolClient } from 'pg'
import { getPool } from '@/lib/db'

// ==========================================================================
// Types
// ==========================================================================

export interface Conversation {
  id: string
  workspaceId: string
  userId: string
  title: string | null
  context: Record<string, unknown>
  status: 'active' | 'archived'
  createdAt: Date
  updatedAt: Date
}

export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string | null
  model: string | null
  finishReason: string | null
  inputTokens: number | null
  outputTokens: number | null
  metadata: Record<string, unknown>
  createdAt: Date
}

export interface ToolCall {
  id: string
  messageId: string
  toolName: string
  toolCallId: string
  input: Record<string, unknown>
  output: Record<string, unknown> | null
  error: string | null
  status: 'pending' | 'running' | 'success' | 'error'
  startedAt: Date | null
  completedAt: Date | null
  createdAt: Date
}

export interface Artifact {
  id: string
  conversationId: string
  messageId: string | null
  type: 'code' | 'document' | 'image' | 'data'
  title: string | null
  content: string
  language: string | null
  mimeType: string | null
  version: number
  createdAt: Date
}

export interface Memory {
  id: string
  workspaceId: string
  type: 'fact' | 'preference' | 'instruction' | 'entity'
  content: string
  sourceConversationId: string | null
  sourceMessageId: string | null
  importance: number
  accessCount: number
  lastAccessed: Date | null
  createdAt: Date
  updatedAt: Date
}

// ==========================================================================
// Conversation Repository
// ==========================================================================

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

// ==========================================================================
// Message Repository
// ==========================================================================

export async function createMessage(
  client: PoolClient,
  params: {
    conversationId: string
    role: 'user' | 'assistant' | 'system'
    content?: string
    model?: string
    finishReason?: string
    inputTokens?: number
    outputTokens?: number
    metadata?: Record<string, unknown>
  }
): Promise<Message> {
  const { conversationId, role, content, model, finishReason, inputTokens, outputTokens, metadata } = params

  const result = await client.query(
    `insert into core.message (conversation_id, role, content, model, finish_reason, input_tokens, output_tokens, metadata)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning
       id,
       conversation_id as "conversationId",
       role,
       content,
       model,
       finish_reason as "finishReason",
       input_tokens as "inputTokens",
       output_tokens as "outputTokens",
       metadata,
       created_at as "createdAt"`,
    [
      conversationId,
      role,
      content || null,
      model || null,
      finishReason || null,
      inputTokens || null,
      outputTokens || null,
      JSON.stringify(metadata || {}),
    ]
  )

  // Update conversation updated_at
  await client.query('update core.conversation set updated_at = now() where id = $1', [conversationId])

  return result.rows[0] as Message
}

export async function getMessagesByConversation(
  client: PoolClient,
  conversationId: string
): Promise<Message[]> {
  const result = await client.query(
    `select
       id,
       conversation_id as "conversationId",
       role,
       content,
       model,
       finish_reason as "finishReason",
       input_tokens as "inputTokens",
       output_tokens as "outputTokens",
       metadata,
       created_at as "createdAt"
     from core.message
     where conversation_id = $1
     order by created_at asc`,
    [conversationId]
  )

  return result.rows as Message[]
}

export async function updateMessageContent(
  client: PoolClient,
  messageId: string,
  content: string
): Promise<Message | null> {
  const result = await client.query(
    `update core.message set content = $2 where id = $1
     returning
       id,
       conversation_id as "conversationId",
       role,
       content,
       model,
       finish_reason as "finishReason",
       input_tokens as "inputTokens",
       output_tokens as "outputTokens",
       metadata,
       created_at as "createdAt"`,
    [messageId, content]
  )

  return (result.rows[0] as Message) || null
}

// ==========================================================================
// Tool Call Repository
// ==========================================================================

export async function createToolCall(
  client: PoolClient,
  params: {
    messageId: string
    toolName: string
    toolCallId: string
    input: Record<string, unknown>
  }
): Promise<ToolCall> {
  const { messageId, toolName, toolCallId, input } = params

  const result = await client.query(
    `insert into core.tool_call (message_id, tool_name, tool_call_id, input)
     values ($1, $2, $3, $4)
     returning
       id,
       message_id as "messageId",
       tool_name as "toolName",
       tool_call_id as "toolCallId",
       input,
       output,
       error,
       status,
       started_at as "startedAt",
       completed_at as "completedAt",
       created_at as "createdAt"`,
    [messageId, toolName, toolCallId, JSON.stringify(input)]
  )

  return result.rows[0] as ToolCall
}

export async function updateToolCallStatus(
  client: PoolClient,
  toolCallId: string,
  status: 'pending' | 'running' | 'success' | 'error',
  output?: Record<string, unknown>,
  error?: string
): Promise<ToolCall | null> {
  const updates = ['status = $2']
  const values: unknown[] = [toolCallId, status]

  if (status === 'running') {
    updates.push('started_at = now()')
  }

  if (status === 'success' || status === 'error') {
    updates.push('completed_at = now()')
    if (output !== undefined) {
      updates.push(`output = $${values.length + 1}`)
      values.push(JSON.stringify(output))
    }
    if (error !== undefined) {
      updates.push(`error = $${values.length + 1}`)
      values.push(error)
    }
  }

  const result = await client.query(
    `update core.tool_call
     set ${updates.join(', ')}
     where id = $1
     returning
       id,
       message_id as "messageId",
       tool_name as "toolName",
       tool_call_id as "toolCallId",
       input,
       output,
       error,
       status,
       started_at as "startedAt",
       completed_at as "completedAt",
       created_at as "createdAt"`,
    values
  )

  return (result.rows[0] as ToolCall) || null
}

export async function getToolCallsByMessage(client: PoolClient, messageId: string): Promise<ToolCall[]> {
  const result = await client.query(
    `select
       id,
       message_id as "messageId",
       tool_name as "toolName",
       tool_call_id as "toolCallId",
       input,
       output,
       error,
       status,
       started_at as "startedAt",
       completed_at as "completedAt",
       created_at as "createdAt"
     from core.tool_call
     where message_id = $1
     order by created_at asc`,
    [messageId]
  )

  return result.rows as ToolCall[]
}

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

// ==========================================================================
// Convenience functions (without client, for simple queries)
// ==========================================================================

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
