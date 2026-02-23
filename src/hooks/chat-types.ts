// Chat domain types shared by useChat and stream parser

// Prevent unbounded memory growth - keep only recent messages
export const MAX_MESSAGES = 100

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
  toolCalls?: {
    id: string
    name: string
    status: 'pending' | 'running' | 'success' | 'error'
    input?: Record<string, unknown>
    output?: Record<string, unknown>
    error?: string
  }[]
}

export interface UseChatOptions {
  workspaceId: string
  workspaceName: string
  /** Current route pathname (e.g. "/tasks") */
  currentPage: string
}
