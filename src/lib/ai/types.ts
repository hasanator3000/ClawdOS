// AI domain types — shared by all repository modules

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
