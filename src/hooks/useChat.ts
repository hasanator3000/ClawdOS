'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { ChatMessage, UseChatOptions } from './chat-types'
import { MAX_MESSAGES } from './chat-types'
import {
  createDisplayFilter,
  parseSSEBuffer,
  parseChatEvent,
  dispatchChatEvent,
} from './chat-stream-parser'

// Re-export types for backwards compatibility
export type { ChatMessage } from './chat-types'

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

      if (isLoading) {
        abortControllerRef.current?.abort()
      }

      const requestSeq = ++requestSeqRef.current

      setError(null)

      const userMessageId = `user-${Date.now()}`
      const userMessage: ChatMessage = { id: userMessageId, role: 'user', content: content.trim() }

      const assistantMessageId = `assistant-${Date.now()}`
      const assistantMessage: ChatMessage = { id: assistantMessageId, role: 'assistant', content: '', isStreaming: true }

      setMessages((prev) => {
        const updated = [...prev, userMessage, assistantMessage]
        return updated.length > MAX_MESSAGES ? updated.slice(-MAX_MESSAGES) : updated
      })
      setIsLoading(true)

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
          const text = await response.text().catch(() => '')
          try {
            const j = JSON.parse(text) as { error?: string }
            throw new Error(j.error || 'Failed to send message')
          } catch {
            throw new Error(text || 'Failed to send message')
          }
        }

        const reader = response.body?.getReader()
        if (!reader) throw new Error('No response stream')
        readerRef.current = reader

        const decoder = new TextDecoder()
        let buffer = ''
        let pendingNavigation: string | null = null
        let refreshTimer: ReturnType<typeof setTimeout> | null = null

        const scheduleRefresh = () => {
          if (refreshTimer) return
          refreshTimer = setTimeout(() => { refreshTimer = null; router.refresh() }, 50)
        }

        const filter = createDisplayFilter()

        const appendVisible = (visibleDelta: string) => {
          if (requestSeq !== requestSeqRef.current || !visibleDelta) return
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId ? { ...msg, content: msg.content + visibleDelta } : msg
            )
          )
        }

        const finalizeAssistant = () => {
          if (requestSeq !== requestSeqRef.current) return
          const flushed = filter.flush()
          if (flushed) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, content: msg.content + flushed, isStreaming: false }
                  : msg
              )
            )
          } else {
            setMessages((prev) =>
              prev.map((msg) => (msg.id === assistantMessageId ? { ...msg, isStreaming: false } : msg))
            )
          }
        }

        const dispatchDeps = {
          currentPage: optionsRef.current.currentPage,
          scheduleRefresh,
          setPendingNavigation: (target: string) => { pendingNavigation = target },
        }

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const parsed = parseSSEBuffer(buffer)
          buffer = parsed.remainder

          for (const data of parsed.frames) {
            const event = parseChatEvent(data)

            if (event.type === 'done') {
              finalizeAssistant()
              continue
            }
            if (event.type === 'conversationId') {
              setConversationId(event.id)
              continue
            }
            if (event.type === 'delta') {
              appendVisible(filter.feed(event.content))
              continue
            }

            // Side-effect events (navigation, refresh, etc.)
            dispatchDeps.currentPage = optionsRef.current.currentPage
            dispatchChatEvent(event, dispatchDeps)
          }
        }

        finalizeAssistant()

        if (pendingNavigation) {
          router.push(pendingNavigation)
          scheduleRefresh()
        }
      } catch (err) {
        readerRef.current?.cancel().catch(() => {})
        readerRef.current = null

        if (err instanceof Error && err.name === 'AbortError') return
        if (requestSeq !== requestSeqRef.current) return

        const errorMessage = err instanceof Error ? err.message : 'Failed to send message'
        setError(errorMessage)
        setMessages((prev) =>
          prev.map((msg) => (msg.id === assistantMessageId ? { ...msg, isStreaming: false } : msg))
        )
      } finally {
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
    requestSeqRef.current += 1
    setIsLoading(false)
  }, [])

  const clearMessages = useCallback(() => {
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

  return { messages, isLoading, error, sendMessage, stopGeneration, clearMessages, conversationId }
}
