// AI types for the agent core

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface StreamToken {
  type: 'token'
  content: string
}

export interface StreamToolStart {
  type: 'tool_start'
  toolName: string
  toolCallId: string
  input: Record<string, unknown>
}

export interface StreamToolEnd {
  type: 'tool_end'
  toolCallId: string
  output: Record<string, unknown> | null
  error: string | null
}

export interface StreamDone {
  type: 'done'
  messageId: string
  inputTokens: number
  outputTokens: number
}

export interface StreamError {
  type: 'error'
  error: string
}

export type StreamEvent = StreamToken | StreamToolStart | StreamToolEnd | StreamDone | StreamError

export interface SendMessageParams {
  conversationId: string
  content: string
  context?: {
    workspaceId: string
    workspaceName: string
    currentPage: string
  }
}

export interface SendMessageResult {
  messageId: string
  conversationId: string
}

// Tool definitions for the agent
export interface ToolDefinition {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

export interface ToolResult {
  success: boolean
  data?: Record<string, unknown>
  error?: string
}

// Agent context
export interface AgentContext {
  workspaceId: string
  workspaceName: string
  userId: string
  currentPage: string
  memories?: string[]
}
