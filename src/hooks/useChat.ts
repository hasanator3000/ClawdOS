'use client'

import { useState, useCallback, useRef } from 'react'
import type { StreamEvent } from '@/lib/ai/types'

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

interface UseChatOptions {
  workspaceId: string
  workspaceName: string
  currentPage: string
}

export function useChat(options: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return

      setError(null)

      // Add user message
      const userMessageId = `user-${Date.now()}`
      const userMessage: ChatMessage = {
        id: userMessageId,
        role: 'user',
        content: content.trim(),
      }

      // Add placeholder assistant message
      const assistantMessageId = `assistant-${Date.now()}`
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        isStreaming: true,
      }

      setMessages((prev) => [...prev, userMessage, assistantMessage])
      setIsLoading(true)

      // Create abort controller for this request
      abortControllerRef.current = new AbortController()

      try {
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId,
            message: content.trim(),
            context: {
              workspaceId: options.workspaceId,
              workspaceName: options.workspaceName,
              currentPage: options.currentPage,
            },
          }),
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to send message')
        }

        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('No response stream')
        }

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          // Process complete SSE events
          const lines = buffer.split('\n\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue

            try {
              const event: StreamEvent = JSON.parse(line.slice(6))

              switch (event.type) {
                case 'token':
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? { ...msg, content: msg.content + event.content }
                        : msg
                    )
                  )
                  break

                case 'tool_start':
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? {
                            ...msg,
                            toolCalls: [
                              ...(msg.toolCalls || []),
                              {
                                id: event.toolCallId,
                                name: event.toolName,
                                status: 'running' as const,
                                input: event.input,
                              },
                            ],
                          }
                        : msg
                    )
                  )
                  break

                case 'tool_end':
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? {
                            ...msg,
                            toolCalls: msg.toolCalls?.map((tc) =>
                              tc.id === event.toolCallId
                                ? {
                                    ...tc,
                                    status: event.error ? ('error' as const) : ('success' as const),
                                    output: event.output || undefined,
                                    error: event.error || undefined,
                                  }
                                : tc
                            ),
                          }
                        : msg
                    )
                  )
                  break

                case 'done':
                  // Update conversation ID and finalize message
                  if (!conversationId) {
                    // Extract conversation ID from the message (we'll need to track this)
                  }
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? { ...msg, id: event.messageId, isStreaming: false }
                        : msg
                    )
                  )
                  break

                case 'error':
                  setError(event.error)
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId ? { ...msg, isStreaming: false } : msg
                    )
                  )
                  break
              }
            } catch {
              // Ignore JSON parse errors for incomplete chunks
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // Request was cancelled
          return
        }

        const errorMessage = err instanceof Error ? err.message : 'Failed to send message'
        setError(errorMessage)
        setMessages((prev) =>
          prev.map((msg) => (msg.id === assistantMessageId ? { ...msg, isStreaming: false } : msg))
        )
      } finally {
        setIsLoading(false)
        abortControllerRef.current = null
      }
    },
    [conversationId, isLoading, options.workspaceId, options.workspaceName, options.currentPage]
  )

  const stopGeneration = useCallback(() => {
    abortControllerRef.current?.abort()
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
    setConversationId(null)
    setError(null)
  }, [])

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    stopGeneration,
    clearMessages,
    conversationId,
  }
}
