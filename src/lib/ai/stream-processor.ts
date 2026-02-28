import { createLogger } from '@/lib/logger'

const log = createLogger('stream')

// Max buffer size to prevent memory exhaustion on large responses
const MAX_ASSISTANT_TEXT_BUFFER = 50_000 // 50KB should be enough for <clawdos> blocks

/**
 * Process stream: filter <clawdos> blocks, execute actions, stream clean text
 * @param upstreamResponse - SSE response from Clawdbot
 * @param userId - Current user ID
 * @param workspaceId - Current workspace ID (or null)
 * @param conversationId - Current conversation ID for persistence (or null)
 * @param executeActionsFn - Function to execute actions (dependency injection)
 * @param saveAssistantMessageFn - Function to save assistant message (dependency injection)
 */
export async function processStreamWithActions(
  upstreamResponse: Response,
  userId: string,
  workspaceId: string | null,
  conversationId: string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  executeActionsFn: (actions: Record<string, any>[], userId: string, workspaceId: string | null) => Promise<{ navigation?: string; results: Array<Record<string, any> & { action?: string }> }>,
  saveAssistantMessageFn: (userId: string, conversationId: string | null, content: string) => Promise<void>
): Promise<ReadableStream> {
  const reader = upstreamResponse.body?.getReader()
  if (!reader) throw new Error('No upstream body')

  const decoder = new TextDecoder()
  const encoder = new TextEncoder()

  let fullAssistantText = '' // Accumulate text for action parsing (bounded)
  let fullVisibleText = '' // Accumulate visible text (without <clawdos> blocks) for DB persistence
  let buffer = ''

  return new ReadableStream({
    async start(controller) {
      // Emit conversationId to client so it can track the session
      if (conversationId) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'conversationId', id: conversationId })}\n\n`)
        )
      }

      try {
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
              if (!data || data === '[DONE]') {
                // Send [DONE] and parse actions
                controller.enqueue(encoder.encode('data: [DONE]\n\n'))

                // Extract and execute actions from full text
                const matches = Array.from(fullAssistantText.matchAll(/<clawdos>([\s\S]*?)<\/clawdos>/g))
                if (matches.length > 0) {
                  const blocks = matches
                    .map((m) => m[1].trim())
                    .map((s) => {
                      const fenced = s.match(/```json\s*([\s\S]*?)\s*```/i)
                      return (fenced?.[1] ?? s).trim()
                    })

                  for (const raw of blocks) {
                    let payload: Record<string, unknown>
                    try {
                      payload = JSON.parse(raw) as Record<string, unknown>
                    } catch {
                      continue
                    }

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const actions: Record<string, any>[] = Array.isArray(payload?.actions) ? payload.actions : []
                    if (actions.length > 0) {
                      log.info('Executing actions', { count: actions.length })
                      const result = await executeActionsFn(actions, userId, workspaceId)
                      log.info('Actions result', { navigation: result.navigation, resultCount: result.results.length })

                      // Send navigation instruction to client if present
                      if (result.navigation) {
                        const navEvent = {
                          type: 'navigation',
                          target: result.navigation,
                        }
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(navEvent)}\n\n`))
                      }

                      // Notify client about task mutations for UI refresh
                      const taskActions = result.results.filter((r) =>
                        r.action?.startsWith('task.')
                      )
                      if (taskActions.length > 0) {
                        const refreshEvent = {
                          type: 'task.refresh',
                          actions: taskActions,
                        }
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(refreshEvent)}\n\n`))
                      }

                      // Notify client about news mutations for UI refresh
                      const newsActions = result.results.filter((r) =>
                        r.action?.startsWith('news.')
                      )
                      if (newsActions.length > 0) {
                        controller.enqueue(
                          encoder.encode(`data: ${JSON.stringify({ type: 'news.refresh', actions: newsActions })}\n\n`)
                        )
                      }

                      // Notify client about delivery mutations for UI refresh
                      const deliveryActions = result.results.filter((r) =>
                        r.action?.startsWith('delivery.')
                      )
                      if (deliveryActions.length > 0) {
                        controller.enqueue(
                          encoder.encode(`data: ${JSON.stringify({ type: 'delivery.refresh', actions: deliveryActions })}\n\n`)
                        )
                      }
                    }
                  }
                }
                continue
              }

              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              let evt: { choices?: Array<{ delta?: { content?: string } }> } & Record<string, any>
              try {
                evt = JSON.parse(data)
              } catch {
                // Forward non-JSON events as-is
                controller.enqueue(encoder.encode(`data: ${data}\n\n`))
                continue
              }

              const choice = evt?.choices?.[0]
              const delta = choice?.delta

              if (typeof delta?.content === 'string') {
                // Accumulate text for action parsing (with size limit to prevent memory bloat)
                if (fullAssistantText.length < MAX_ASSISTANT_TEXT_BUFFER) {
                  fullAssistantText += delta.content
                  // Truncate if we exceed limit
                  if (fullAssistantText.length > MAX_ASSISTANT_TEXT_BUFFER) {
                    fullAssistantText = fullAssistantText.slice(-MAX_ASSISTANT_TEXT_BUFFER)
                  }
                }

                // Filter out <clawdos> blocks from displayed content
                const filtered = filterClawdosBlocks(delta.content)

                // Send filtered delta to client
                if (filtered) {
                  fullVisibleText += filtered
                  const filteredEvt = {
                    ...evt,
                    choices: [
                      {
                        ...choice,
                        delta: { ...delta, content: filtered },
                      },
                    ],
                  }
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(filteredEvt)}\n\n`))
                }
              } else {
                // Forward other events as-is
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`))
              }
            }
          }
        }
      } catch (err) {
        log.error('Stream processing error', { error: err instanceof Error ? err.message : String(err) })
        // Notify client about the error before closing
        try {
          const errorEvent = {
            type: 'error',
            message: err instanceof Error ? err.message : 'Stream processing failed',
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`))
        } catch {
          // Ignore if we can't send error event
        }
      } finally {
        // Persist assistant message to DB (fire-and-forget)
        if (conversationId && fullVisibleText.trim()) {
          saveAssistantMessageFn(userId, conversationId, fullVisibleText.trim()).catch(() => {})
        }
        controller.close()
      }
    },
  })
}

/**
 * Simple filter: remove <clawdos>...</clawdos> blocks (handles complete blocks only)
 * For cross-chunk split handling, client-side filtering remains as fallback
 */
function filterClawdosBlocks(text: string): string {
  return text.replace(/<clawdos>[\s\S]*?<\/clawdos>/g, '')
}
