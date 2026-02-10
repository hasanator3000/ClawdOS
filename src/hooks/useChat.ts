'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'

// Prevent unbounded memory growth - keep only recent messages
const MAX_MESSAGES = 100

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
  /** Current route pathname (e.g. "/tasks") */
  currentPage: string
}

export function useChat(options: UseChatOptions) {
  const router = useRouter()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)
  const requestSeqRef = useRef(0)

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return

      // If a request is in-flight, cancel it so the UI stays responsive.
      if (isLoading) {
        abortControllerRef.current?.abort()
      }

      const requestSeq = ++requestSeqRef.current

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

      setMessages((prev) => {
        const updated = [...prev, userMessage, assistantMessage]
        // Keep only recent messages to prevent memory bloat
        return updated.length > MAX_MESSAGES ? updated.slice(-MAX_MESSAGES) : updated
      })
      setIsLoading(true)

      // All messages go to the server — command registry handles fast-paths there.
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
        readerRef.current = reader

        const decoder = new TextDecoder()
        let buffer = ''

        // Server can emit structured events during streaming.
        // Navigation must be deferred until the stream ends, otherwise the page transition
        // will tear down this request and we may miss follow-up events (e.g. task.refresh).
        let pendingNavigation: string | null = null
        let refreshTimer: ReturnType<typeof setTimeout> | null = null

        const scheduleRefresh = () => {
          if (refreshTimer) return
          refreshTimer = setTimeout(() => {
            refreshTimer = null
            router.refresh()
          }, 50)
        }

        let displayBuffer = '' // Buffer for incomplete tags during streaming
        let inLifeosBlock = false

        const appendAssistant = (delta: string) => {
          if (requestSeq !== requestSeqRef.current) return
          if (!delta) return

          // Add to buffer for tag-aware filtering (server filters most, this is fallback)
          displayBuffer += delta
          let visibleDelta = ''

          // Process buffer with tag detection (handles split tags across chunks)
          while (displayBuffer.length > 0) {
            if (!inLifeosBlock) {
              // Look for opening tag
              const openIdx = displayBuffer.indexOf('<lifeos>')

              if (openIdx === -1) {
                // No complete opening tag found
                // Check if buffer ends with partial tag start to avoid displaying incomplete tags
                let keepLen = 0
                for (let len = Math.min(7, displayBuffer.length); len > 0; len--) {
                  if ('<lifeos>'.startsWith(displayBuffer.slice(-len))) {
                    keepLen = len
                    break
                  }
                }

                if (keepLen > 0) {
                  // Keep potential tag start in buffer
                  visibleDelta += displayBuffer.slice(0, -keepLen)
                  displayBuffer = displayBuffer.slice(-keepLen)
                  break
                } else {
                  // No potential tag, flush everything
                  visibleDelta += displayBuffer
                  displayBuffer = ''
                  break
                }
              } else {
                // Found opening tag
                visibleDelta += displayBuffer.slice(0, openIdx)
                displayBuffer = displayBuffer.slice(openIdx + 8) // Skip '<lifeos>'
                inLifeosBlock = true
              }
            } else {
              // Inside block, look for closing tag
              const closeIdx = displayBuffer.indexOf('</lifeos>')

              if (closeIdx === -1) {
                // No complete closing tag found
                // Check if buffer ends with partial closing tag start
                let keepLen = 0
                for (let len = Math.min(8, displayBuffer.length); len > 0; len--) {
                  if ('</lifeos>'.startsWith(displayBuffer.slice(-len))) {
                    keepLen = len
                    break
                  }
                }

                if (keepLen > 0) {
                  // Keep potential tag start in buffer
                  displayBuffer = displayBuffer.slice(-keepLen)
                  break
                } else {
                  // No potential closing tag, discard all (we're inside the block)
                  displayBuffer = ''
                  break
                }
              } else {
                // Found closing tag
                displayBuffer = displayBuffer.slice(closeIdx + 9) // Skip '</lifeos>'
                inLifeosBlock = false
              }
            }
          }

          // Update visible message content (only non-<lifeos> text)
          if (visibleDelta) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId ? { ...msg, content: msg.content + visibleDelta } : msg
              )
            )
          }
        }

        const finalizeAssistant = () => {
          if (requestSeq !== requestSeqRef.current) return
          // Flush any remaining displayBuffer (if stream ended mid-tag, show what we have)
          if (!inLifeosBlock && displayBuffer) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, content: msg.content + displayBuffer, isStreaming: false }
                  : msg
              )
            )
            displayBuffer = ''
          } else {
            setMessages((prev) =>
              prev.map((msg) => (msg.id === assistantMessageId ? { ...msg, isStreaming: false } : msg))
            )
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

              // Handle navigation events from server
              if (evt?.type === 'navigation' && evt?.target) {
                const target = String(evt.target)
                pendingNavigation = target
                continue
              }

              // Handle tasks filter events
              if (evt?.type === 'tasks.filter' && evt?.value) {
                const value = String(evt.value)
                window.dispatchEvent(new CustomEvent('lifeos:tasks-filter', { detail: { value } }))
                // If we're not on /tasks, navigate there.
                if (options.currentPage !== '/tasks') {
                  pendingNavigation = '/tasks'
                }
                continue
              }

              // Handle task refresh events
              if (evt?.type === 'task.refresh') {
                // Dispatch custom event for client lists (TaskList) to patch state instantly
                window.dispatchEvent(
                  new CustomEvent('lifeos:task-refresh', {
                    detail: { actions: evt.actions },
                  })
                )

                // Also refresh server components (sidebar badges, today widgets, etc.)
                // Debounced to avoid over-refreshing while streaming.
                scheduleRefresh()
                continue
              }

              // Handle news refresh events
              if (evt?.type === 'news.refresh') {
                window.dispatchEvent(
                  new CustomEvent('lifeos:news-refresh', {
                    detail: { actions: evt.actions },
                  })
                )
                scheduleRefresh()
                continue
              }

              // Handle news sources panel open
              if (evt?.type === 'news.sources.open') {
                window.dispatchEvent(new CustomEvent('lifeos:news-sources-open'))
                if (options.currentPage !== '/news') {
                  pendingNavigation = '/news'
                }
                continue
              }

              // Handle news tab switch events
              if (evt?.type === 'news.tab.switch' && evt?.tabName) {
                window.dispatchEvent(
                  new CustomEvent('lifeos:news-tab-switch', {
                    detail: { tabName: String(evt.tabName) },
                  })
                )
                continue
              }

              // Handle workspace switch events
              if (evt?.type === 'workspace.switch' && evt?.workspaceId) {
                window.dispatchEvent(
                  new CustomEvent('lifeos:workspace-switch', {
                    detail: { workspaceId: String(evt.workspaceId) },
                  })
                )
                scheduleRefresh()
                continue
              }

              // OpenAI chat.completions streaming shape
              const choice = evt?.choices?.[0]
              const delta = choice?.delta

              // Handle text content (already filtered by server)
              if (typeof delta?.content === 'string') {
                appendAssistant(delta.content)
              }
            }
          }
        }

        // Finalize message
        finalizeAssistant()

        // Execute deferred navigation after the stream ends, so we don't miss events.
        if (pendingNavigation) {
          router.push(pendingNavigation)
          // Ensure server-rendered parts on the destination reflect the latest data.
          scheduleRefresh()
        }
      } catch (err) {
        // Always cleanup stream reader to prevent connection leaks
        readerRef.current?.cancel().catch(() => {})
        readerRef.current = null

        if (err instanceof Error && err.name === 'AbortError') {
          // Request was cancelled
          return
        }

        if (requestSeq !== requestSeqRef.current) return

        const errorMessage = err instanceof Error ? err.message : 'Failed to send message'
        setError(errorMessage)
        setMessages((prev) =>
          prev.map((msg) => (msg.id === assistantMessageId ? { ...msg, isStreaming: false } : msg))
        )
      } finally {
        // Ensure reader is always cleaned up
        readerRef.current?.cancel().catch(() => {})
        readerRef.current = null

        if (requestSeq === requestSeqRef.current) {
          setIsLoading(false)
          abortControllerRef.current = null
        }
      }
    },
    [conversationId, isLoading, options.workspaceId, options.workspaceName, options.currentPage]
  )

  const stopGeneration = useCallback(() => {
    abortControllerRef.current?.abort()
    // Invalidate current stream updates
    requestSeqRef.current += 1
    setIsLoading(false)
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
