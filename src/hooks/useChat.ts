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

        let assistantFullText = '' // Full text including <lifeos> blocks for action execution
        let displayBuffer = '' // Buffer for incomplete tags during streaming
        let inLifeosBlock = false

        // Tool call accumulation (arguments come in chunks)
        const toolCallsMap = new Map<string, { name: string; arguments: string }>()
        const executedTools = new Set<string>()

        const appendAssistant = (delta: string) => {
          if (!delta) return

          // Always accumulate full text for later action execution
          assistantFullText += delta

          // Add to buffer for tag-aware filtering
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
              const choice = evt?.choices?.[0]
              const delta = choice?.delta

              // Handle text content
              if (typeof delta?.content === 'string') {
                appendAssistant(delta.content)
              }

              // Handle tool calls (arguments come in chunks, must accumulate)
              if (Array.isArray(delta?.tool_calls)) {
                for (const toolCall of delta.tool_calls) {
                  const index = toolCall.index ?? 0
                  const toolId = `tool_${index}`

                  // Accumulate tool call data
                  if (!toolCallsMap.has(toolId)) {
                    toolCallsMap.set(toolId, { name: '', arguments: '' })
                  }

                  const accumulated = toolCallsMap.get(toolId)!

                  if (toolCall.function?.name) {
                    accumulated.name = toolCall.function.name
                  }

                  if (toolCall.function?.arguments) {
                    accumulated.arguments += toolCall.function.arguments
                  }
                }
              }

              // Check if any tool calls are complete (finish_reason will tell us)
              const finishReason = choice?.finish_reason
              if (finishReason === 'tool_calls' || finishReason === 'stop') {
                // Execute accumulated tool calls
                for (const [toolId, toolData] of toolCallsMap.entries()) {
                  if (executedTools.has(toolId)) continue // Already executed
                  if (!toolData.name || !toolData.arguments) continue // Not complete

                  let args: any = {}
                  try {
                    args = JSON.parse(toolData.arguments)
                  } catch {
                    console.warn('Failed to parse tool arguments:', toolData.arguments)
                    continue
                  }

                  executedTools.add(toolId)

                  // Execute tool (whitelisted actions)
                  const ALLOWED_PAGES = new Set(['/today', '/news', '/tasks', '/settings'])

                  if (toolData.name === 'navigate_page' && args.page && ALLOWED_PAGES.has(args.page)) {
                    console.log('Navigating to:', args.page)
                    window.location.assign(args.page)
                  } else if (toolData.name === 'create_task' && args.title) {
                    console.log('Creating task:', args.title)
                    await fetch('/api/actions/task', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        title: String(args.title),
                        description: args.description ? String(args.description) : undefined,
                        priority: typeof args.priority === 'number' ? args.priority : undefined,
                      }),
                    }).catch((err) => console.error('Task creation failed:', err))
                  } else if (toolData.name === 'complete_task' && args.taskId) {
                    console.log('Completing task:', args.taskId)
                    await fetch('/api/actions/task', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ op: 'complete', taskId: String(args.taskId) }),
                    }).catch((err) => console.error('Task completion failed:', err))
                  } else if (toolData.name === 'reopen_task' && args.taskId) {
                    console.log('Reopening task:', args.taskId)
                    await fetch('/api/actions/task', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ op: 'reopen', taskId: String(args.taskId) }),
                    }).catch((err) => console.error('Task reopen failed:', err))
                  }
                }
              }
            }
          }
        }

        // Finalize message first
        finalizeAssistant()

        // Execute any post-response LifeOS actions (best-effort)
        // Note: <lifeos> blocks are already filtered during streaming, so no need to remove them here
        try {
          if (assistantFullText) await tryExecuteLifeOSActions(assistantFullText)
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
