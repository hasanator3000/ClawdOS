'use client'

import { useState, useCallback, useRef } from 'react'

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
          // Best-effort error parsing; upstream may return plain text.
          const text = await response.text().catch(() => '')
          try {
            const j = JSON.parse(text) as { error?: string }
            throw new Error(j.error || 'Failed to send message')
          } catch {
            throw new Error(text || 'Failed to send message')
          }
        }

        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('No response stream')
        }

        const decoder = new TextDecoder()
        let buffer = ''

        let assistantFullText = ''

        const appendAssistant = (delta: string) => {
          if (!delta) return
          assistantFullText += delta
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId ? { ...msg, content: msg.content + delta } : msg
            )
          )
        }

        const finalizeAssistant = () => {
          setMessages((prev) =>
            prev.map((msg) => (msg.id === assistantMessageId ? { ...msg, isStreaming: false } : msg))
          )
        }

        const tryExecuteLifeOSActions = async (fullText: string) => {
          // Look for <lifeos>...</lifeos> blocks and execute a small, safe whitelist.
          // We accept either raw JSON or ```json fenced blocks inside.
          const matches = Array.from(fullText.matchAll(/<lifeos>([\s\S]*?)<\/lifeos>/g))
          if (matches.length === 0) return

          const blocks = matches
            .map((m) => m[1].trim())
            .map((s) => {
              const fenced = s.match(/```json\s*([\s\S]*?)\s*```/i)
              return (fenced?.[1] ?? s).trim()
            })

          const ALLOWED_PATHS = new Set(['/today', '/news', '/tasks', '/settings'])

          for (const raw of blocks) {
            let payload: any
            try {
              payload = JSON.parse(raw)
            } catch {
              continue
            }

            const actions: any[] = Array.isArray(payload?.actions) ? payload.actions : []
            for (const a of actions) {
              const k = a?.k
              if (k === 'navigate') {
                const to = String(a?.to || '')
                if (ALLOWED_PATHS.has(to)) window.location.assign(to)
              }
              if (k === 'task.create') {
                const title = String(a?.title || '').trim()
                if (!title) continue
                await fetch('/api/actions/task', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    title,
                    description: a?.description ? String(a.description) : undefined,
                    priority: typeof a?.priority === 'number' ? a.priority : undefined,
                  }),
                })
              }
              if (k === 'task.complete' || k === 'task.reopen') {
                const taskId = String(a?.taskId || '')
                if (!taskId) continue
                await fetch('/api/actions/task', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ op: k === 'task.complete' ? 'complete' : 'reopen', taskId }),
                })
              }
            }
          }
        }

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          // SSE frames separated by blank line
          const frames = buffer.split('\n\n')
          buffer = frames.pop() || ''

          for (const frame of frames) {
            const dataLines = frame
              .split('\n')
              .filter((l) => l.startsWith('data: '))
              .map((l) => l.slice(6).trim())

            for (const data of dataLines) {
              if (!data) continue
              if (data === '[DONE]') {
                finalizeAssistant()
                continue
              }

              let evt: any
              try {
                evt = JSON.parse(data)
              } catch {
                continue
              }

              // OpenAI chat.completions streaming shape
              const delta = evt?.choices?.[0]?.delta?.content
              if (typeof delta === 'string') appendAssistant(delta)
            }
          }
        }

        // Finalize message first
        finalizeAssistant()

        // Execute any post-response LifeOS actions (best-effort)
        try {
          if (assistantFullText) await tryExecuteLifeOSActions(assistantFullText)

          // Hide <lifeos> blocks from the visible transcript.
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: msg.content.replace(/<lifeos>[\s\S]*?<\/lifeos>/g, '').trim() }
                : msg
            )
          )
        } catch {}
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
