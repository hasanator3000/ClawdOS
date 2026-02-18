'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
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
  const loadedWorkspaceRef = useRef<string | null>(null)

  // Use refs for values that change often but shouldn't recreate sendMessage
  const optionsRef = useRef(options)
  optionsRef.current = options

  // Load existing conversation on mount (or workspace change)
  useEffect(() => {
    if (!options.workspaceId || loadedWorkspaceRef.current === options.workspaceId) return
    loadedWorkspaceRef.current = options.workspaceId

    fetch(`/api/ai/chat?workspaceId=${encodeURIComponent(options.workspaceId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return
        if (data.conversationId) setConversationId(data.conversationId)
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          setMessages(data.messages)
        }
      })
      .catch(() => {})
  }, [options.workspaceId])

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
              workspaceId: optionsRef.current.workspaceId,
              workspaceName: optionsRef.current.workspaceName,
              currentPage: optionsRef.current.currentPage,
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
        let inClawdosBlock = false

        const appendAssistant = (delta: string) => {
          if (requestSeq !== requestSeqRef.current) return
          if (!delta) return

          // Add to buffer for tag-aware filtering (server filters most, this is fallback)
          displayBuffer += delta
          let visibleDelta = ''

          // Process buffer with tag detection (handles split tags across chunks)
          while (displayBuffer.length > 0) {
            if (!inClawdosBlock) {
              // Look for opening tag
              const openIdx = displayBuffer.indexOf('<clawdos>')

              if (openIdx === -1) {
                // No complete opening tag found
                // Check if buffer ends with partial tag start to avoid displaying incomplete tags
                let keepLen = 0
                for (let len = Math.min(7, displayBuffer.length); len > 0; len--) {
                  if ('<clawdos>'.startsWith(displayBuffer.slice(-len))) {
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
                displayBuffer = displayBuffer.slice(openIdx + 8) // Skip '<clawdos>'
                inClawdosBlock = true
              }
            } else {
              // Inside block, look for closing tag
              const closeIdx = displayBuffer.indexOf('</clawdos>')

              if (closeIdx === -1) {
                // No complete closing tag found
                // Check if buffer ends with partial closing tag start
                let keepLen = 0
                for (let len = Math.min(8, displayBuffer.length); len > 0; len--) {
                  if ('</clawdos>'.startsWith(displayBuffer.slice(-len))) {
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
                displayBuffer = displayBuffer.slice(closeIdx + 9) // Skip '</clawdos>'
                inClawdosBlock = false
              }
            }
          }

          // Update visible message content (only non-<clawdos> text)
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
          if (!inClawdosBlock && displayBuffer) {
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

              // Track conversationId from server
              if (evt?.type === 'conversationId' && evt?.id) {
                setConversationId(String(evt.id))
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
                window.dispatchEvent(new CustomEvent('clawdos:tasks-filter', { detail: { value } }))
                // If we're not on /tasks, navigate there.
                if (optionsRef.current.currentPage !== '/tasks') {
                  pendingNavigation = '/tasks'
                }
                continue
              }

              // Handle task refresh events
              if (evt?.type === 'task.refresh') {
                // Dispatch custom event for client lists (TaskList) to patch state instantly
                window.dispatchEvent(
                  new CustomEvent('clawdos:task-refresh', {
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
                  new CustomEvent('clawdos:news-refresh', {
                    detail: { actions: evt.actions },
                  })
                )
                scheduleRefresh()
                continue
              }

              // Handle news sources panel open
              if (evt?.type === 'news.sources.open') {
                window.dispatchEvent(new CustomEvent('clawdos:news-sources-open'))
                if (optionsRef.current.currentPage !== '/news') {
                  pendingNavigation = '/news'
                }
                continue
              }

              // Handle news tab switch events
              if (evt?.type === 'news.tab.switch') {
                window.dispatchEvent(
                  new CustomEvent('clawdos:news-tab-switch', {
                    detail: {
                      tabId: evt.tabId ?? undefined,
                      tabName: evt.tabName ? String(evt.tabName) : undefined,
                    },
                  })
                )
                continue
              }

              // Handle workspace switch events
              if (evt?.type === 'workspace.switch' && evt?.workspaceId) {
                window.dispatchEvent(
                  new CustomEvent('clawdos:workspace-switch', {
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
    [conversationId, isLoading]
  )

  const stopGeneration = useCallback(() => {
    abortControllerRef.current?.abort()
    // Invalidate current stream updates
    requestSeqRef.current += 1
    setIsLoading(false)
  }, [])

  const clearMessages = useCallback(() => {
    // Archive conversation in DB before clearing local state
    if (conversationId) {
      fetch('/api/ai/chat', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId }),
      }).catch(() => {})
    }
    setMessages([])
    setConversationId(null)
    setError(null)
    loadedWorkspaceRef.current = null
  }, [conversationId])

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
