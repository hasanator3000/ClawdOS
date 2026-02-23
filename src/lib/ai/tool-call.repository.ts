import type { PoolClient } from 'pg'
import type { ToolCall } from './types'

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
