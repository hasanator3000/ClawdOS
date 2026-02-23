import type { PoolClient } from 'pg'
import type { Message } from './types'

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
