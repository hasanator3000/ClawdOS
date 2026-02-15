import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSession } from '@/lib/auth/session'
import { withUser } from '@/lib/db'
import type { CommandResult } from '@/lib/commands/chat-handlers'
import { routeCommand } from '@/lib/intents/router'
import { getWorkspacesForUser } from '@/lib/workspace'
import { ACTIVE_WORKSPACE_COOKIE } from '@/lib/constants'
import {
  createTask as createTaskRepo,
  completeTask as completeTaskRepo,
  reopenTask as reopenTaskRepo,
  deleteTask as deleteTaskRepo,
} from '@/lib/db/repositories/task.repository'
import {
  createNewsSource,
  deleteNewsSource,
} from '@/lib/db/repositories/news-source.repository'
import {
  createNewsTab,
  assignSourceToTab as assignSourceToTabRepo,
  findTabsByWorkspace,
} from '@/lib/db/repositories/news-tab.repository'
import {
  createConversation,
  createMessage,
  getActiveConversation,
  getMessagesByConversation,
  updateConversation,
} from '@/lib/ai/repository'

export const dynamic = 'force-dynamic'

const MAX_MESSAGE_LENGTH = 10_000

// Whitelisted navigation paths (kept here for executeActions validation)
const ALLOWED_PATHS = new Set([
  '/today',
  '/news',
  '/tasks',
  '/settings',
  '/settings/telegram',
  '/settings/password',
])

function getGateway() {
  const url = process.env.CLAWDBOT_URL || 'http://127.0.0.1:18789'
  const token = process.env.CLAWDBOT_TOKEN
  if (!token) throw new Error('CLAWDBOT_TOKEN is not set')
  return { url: url.replace(/\/$/, ''), token }
}

async function getTelegramUserIdForSessionUser(userId: string): Promise<string | null> {
  return withUser(userId, async (client) => {
    const res = await client.query('select telegram_user_id from core."user" where id=$1', [userId])
    return (res.rows[0]?.telegram_user_id as string | null) ?? null
  })
}

// Execute privileged actions (task mutations) on server under session + RLS
async function executeActions(
  actions: any[],
  userId: string,
  workspaceId: string | null
): Promise<{ navigation?: string; results: any[] }> {
  let navigationTarget: string | undefined
  const results: any[] = []

  // Track tab name→id for source-tab assignment within same batch
  const tabNameToId = new Map<string, string>()

  // Pre-load existing tabs so source.add can reference them
  if (workspaceId && actions.some((a) => a?.k === 'news.source.add' && a?.tabs?.length)) {
    try {
      const existingTabs = await withUser(userId, (client) =>
        findTabsByWorkspace(client, workspaceId)
      )
      for (const t of existingTabs) {
        tabNameToId.set(t.name.toLowerCase(), t.id)
      }
    } catch { /* ignore */ }
  }

  for (const action of actions) {
    const k = action?.k

    // Navigation: return target to client (non-privileged)
    if (k === 'navigate') {
      const to = String(action?.to || '')
      if (ALLOWED_PATHS.has(to)) {
        navigationTarget = to
        results.push({ action: 'navigate', to })
      }
    }

    // Task actions: execute on server with RLS
    if (k === 'task.create') {
      const title = String(action?.title || '').trim()
      if (!title) continue

      if (!workspaceId) {
        results.push({ action: 'task.create', error: 'No workspace' })
        continue
      }

      try {
        const task = await withUser(userId, async (client) => {
          return createTaskRepo(client, {
            title,
            description: action?.description ? String(action.description) : undefined,
            priority: typeof action?.priority === 'number' ? action.priority : undefined,
            workspaceId,
          })
        })

        results.push({ action: 'task.create', taskId: task.id, task })
      } catch (err) {
        results.push({ action: 'task.create', error: String(err) })
      }
    }

    if (k === 'task.complete') {
      const taskId = String(action?.taskId || '')
      if (!taskId) continue

      try {
        const task = await withUser(userId, async (client) => completeTaskRepo(client, taskId))
        results.push({ action: 'task.complete', taskId, task })
      } catch (err) {
        results.push({ action: 'task.complete', error: String(err) })
      }
    }

    if (k === 'task.reopen') {
      const taskId = String(action?.taskId || '')
      if (!taskId) continue

      try {
        const task = await withUser(userId, async (client) => reopenTaskRepo(client, taskId))
        results.push({ action: 'task.reopen', taskId, task })
      } catch (err) {
        results.push({ action: 'task.reopen', error: String(err) })
      }
    }

    if (k === 'task.delete') {
      const taskId = String(action?.taskId || '')
      if (!taskId) continue

      try {
        const ok = await withUser(userId, async (client) => deleteTaskRepo(client, taskId))
        results.push({ action: 'task.delete', taskId, success: Boolean(ok) })
      } catch (err) {
        results.push({ action: 'task.delete', error: String(err) })
      }
    }

    // News actions — create source record fast (no inline validation/fetch)
    // The refresh cycle will validate and fetch items asynchronously.
    if (k === 'news.source.add') {
      const url = String(action?.url || '').trim()
      if (!url || !workspaceId) continue

      // Quick URL format check only (no network)
      try {
        const parsed = new URL(url)
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          results.push({ action: 'news.source.add', error: 'URL must use http or https' })
          continue
        }
      } catch {
        results.push({ action: 'news.source.add', error: 'Invalid URL format' })
        continue
      }

      try {
        const source = await withUser(userId, async (client) => {
          const s = await createNewsSource(client, { workspaceId, url, title: action?.title as string | undefined })

          // Assign to tabs by name (supports both newly created and existing tabs)
          const tabNames: string[] = Array.isArray(action?.tabs) ? action.tabs : []
          for (const tn of tabNames) {
            const tabId = tabNameToId.get(String(tn).toLowerCase())
            if (tabId) {
              await assignSourceToTabRepo(client, s.id, tabId)
            }
          }

          return s
        })
        results.push({ action: 'news.source.add', source })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('news_source_ws_url_uniq')) {
          results.push({ action: 'news.source.add', error: 'Source already added' })
        } else {
          results.push({ action: 'news.source.add', error: msg })
        }
      }
    }

    if (k === 'news.source.remove') {
      const sourceId = String(action?.sourceId || '')
      if (!sourceId) continue

      try {
        const ok = await withUser(userId, async (client) => deleteNewsSource(client, sourceId))
        results.push({ action: 'news.source.remove', sourceId, success: Boolean(ok) })
      } catch (err) {
        results.push({ action: 'news.source.remove', error: String(err) })
      }
    }

    if (k === 'news.tab.create') {
      const name = String(action?.name || '').trim()
      if (!name || !workspaceId) continue

      try {
        const tab = await withUser(userId, async (client) =>
          createNewsTab(client, { workspaceId, name })
        )
        tabNameToId.set(name.toLowerCase(), tab.id)
        results.push({ action: 'news.tab.create', tab })
      } catch (err) {
        results.push({ action: 'news.tab.create', error: String(err) })
      }
    }
  }

  return { navigation: navigationTarget, results }
}

// Process stream: filter <clawdos> blocks, execute actions, stream clean text
// Max buffer size to prevent memory exhaustion on large responses
const MAX_ASSISTANT_TEXT_BUFFER = 50_000 // 50KB should be enough for <clawdos> blocks

async function processStreamWithActions(
  upstreamResponse: Response,
  userId: string,
  workspaceId: string | null,
  conversationId: string | null = null
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
                    let payload: any
                    try {
                      payload = JSON.parse(raw)
                    } catch {
                      continue
                    }

                    const actions: any[] = Array.isArray(payload?.actions) ? payload.actions : []
                    if (actions.length > 0) {
                      console.log('[ClawdOS] Executing actions:', actions)
                      const result = await executeActions(actions, userId, workspaceId)
                      console.log('[ClawdOS] Actions result:', result)

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
                    }
                  }
                }
                continue
              }

              let evt: any
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
        console.error('Stream processing error:', err)
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
          saveAssistantMessage(userId, conversationId, fullVisibleText.trim()).catch(() => {})
        }
        controller.close()
      }
    },
  })
}

// Simple filter: remove <clawdos>...</clawdos> blocks (handles complete blocks only)
// For cross-chunk split handling, client-side filtering remains as fallback
function filterClawdosBlocks(text: string): string {
  return text.replace(/<clawdos>[\s\S]*?<\/clawdos>/g, '')
}

// ---------------------------------------------------------------------------
// Build fast-path SSE response from a CommandResult
// ---------------------------------------------------------------------------

function buildFastPathResponse(
  result: CommandResult,
  encoder: TextEncoder,
  userId: string,
  workspaceId: string | null
): Response | Promise<Response> {
  switch (result.type) {
    case 'task.create':
      return buildTaskCreateResponse(result.title, encoder, userId, workspaceId)

    case 'navigation':
      return buildNavigationResponse(result.target, result.label, encoder)

    case 'tasks.filter':
      return buildTasksFilterResponse(result.filter, encoder)

    case 'workspace.switch':
      return buildWorkspaceSwitchResponse(result.targetType, encoder)

    case 'news.sources.open':
      return buildNewsSourcesOpenResponse(encoder)

    case 'news.search':
      return buildNewsSearchResponse(result.query, encoder)

    case 'news.tab.switch':
      return buildNewsTabSwitchResponse(result.tabName, encoder, userId, workspaceId)
  }
}

function sseResponse(body: ReadableStream): Response {
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}

async function buildTaskCreateResponse(
  title: string,
  encoder: TextEncoder,
  userId: string,
  workspaceId: string | null
): Promise<Response> {
  if (!workspaceId) {
    return NextResponse.json({ error: 'No workspace selected' }, { status: 400 })
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const task = await withUser(userId, async (client) => {
          return createTaskRepo(client, { title, workspaceId })
        })

        const content = `Создал задачу: ${task.title}.`
        const evt = {
          id: 'clawdos-task-create',
          object: 'chat.completion.chunk',
          choices: [{ index: 0, delta: { role: 'assistant', content } }],
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`))

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'task.refresh', actions: [{ action: 'task.create', taskId: task.id, task }] })}\n\n`
          )
        )

        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch {
        const evt = {
          id: 'clawdos-task-create-error',
          object: 'chat.completion.chunk',
          choices: [{ index: 0, delta: { role: 'assistant', content: 'Не смог создать задачу.' } }],
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      }
    },
  })

  return sseResponse(stream)
}

function buildNavigationResponse(
  target: string,
  label: string,
  encoder: TextEncoder
): Response {
  const stream = new ReadableStream({
    start(controller) {
      const content = `Открыл раздел: ${label}.`
      const evt = {
        id: 'clawdos-nav',
        object: 'chat.completion.chunk',
        choices: [{ index: 0, delta: { role: 'assistant', content } }],
      }
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`))
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'navigation', target })}\n\n`)
      )
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })

  return sseResponse(stream)
}

function buildTasksFilterResponse(
  filter: string,
  encoder: TextEncoder
): Response {
  const filterLabels: Record<string, string> = {
    active: 'активные',
    completed: 'выполненные',
    all: 'все',
  }

  const stream = new ReadableStream({
    start(controller) {
      const content = `Показываю ${filterLabels[filter] ?? filter} задачи.`
      const evt = {
        id: 'clawdos-filter',
        object: 'chat.completion.chunk',
        choices: [{ index: 0, delta: { role: 'assistant', content } }],
      }
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`))
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'tasks.filter', value: filter })}\n\n`)
      )
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })

  return sseResponse(stream)
}

async function buildWorkspaceSwitchResponse(
  targetType: 'personal' | 'shared',
  encoder: TextEncoder
): Promise<Response> {
  const workspaces = await getWorkspacesForUser()
  const target = workspaces.find((w) => w.type === targetType)

  if (!target) {
    const stream = new ReadableStream({
      start(controller) {
        const label = targetType === 'personal' ? 'личный' : 'общий'
        const content = `Не нашёл ${label} workspace.`
        const evt = {
          id: 'clawdos-ws-switch-error',
          object: 'chat.completion.chunk',
          choices: [{ index: 0, delta: { role: 'assistant', content } }],
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })
    return sseResponse(stream)
  }

  // Set workspace cookie
  const cookieStore = await cookies()
  cookieStore.set(ACTIVE_WORKSPACE_COOKIE, target.id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })

  const label = targetType === 'personal' ? 'личные' : 'общие'

  const stream = new ReadableStream({
    start(controller) {
      const content = `Переключил на ${label} задачи (${target.name}).`
      const evt = {
        id: 'clawdos-ws-switch',
        object: 'chat.completion.chunk',
        choices: [{ index: 0, delta: { role: 'assistant', content } }],
      }
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`))

      // Notify client about workspace switch
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: 'workspace.switch', workspaceId: target.id })}\n\n`
        )
      )

      // Navigate to /tasks
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'navigation', target: '/tasks' })}\n\n`)
      )

      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })

  return sseResponse(stream)
}

function buildNewsSourcesOpenResponse(encoder: TextEncoder): Response {
  const stream = new ReadableStream({
    start(controller) {
      const content = 'Открываю панель источников новостей.'
      const evt = {
        id: 'clawdos-news-sources',
        object: 'chat.completion.chunk',
        choices: [{ index: 0, delta: { role: 'assistant', content } }],
      }
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`))
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'news.sources.open' })}\n\n`)
      )
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'navigation', target: '/news' })}\n\n`)
      )
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })
  return sseResponse(stream)
}

function buildNewsSearchResponse(query: string, encoder: TextEncoder): Response {
  const stream = new ReadableStream({
    start(controller) {
      const content = `Ищу новости: "${query}".`
      const evt = {
        id: 'clawdos-news-search',
        object: 'chat.completion.chunk',
        choices: [{ index: 0, delta: { role: 'assistant', content } }],
      }
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`))
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'navigation', target: '/news' })}\n\n`)
      )
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })
  return sseResponse(stream)
}

async function buildNewsTabSwitchResponse(
  tabName: string,
  encoder: TextEncoder,
  userId: string,
  workspaceId: string | null
): Promise<Response> {
  // Resolve tab from DB with fuzzy matching
  let resolvedTabId: string | null = null
  let resolvedTabName = tabName

  if (workspaceId) {
    const { findTabsByWorkspace } = await import('@/lib/db/repositories/news-tab.repository')
    const tabs = await withUser(userId, (client) => findTabsByWorkspace(client, workspaceId))
    const query = tabName.toLowerCase()

    // 1. Exact match (case-insensitive)
    let match = tabs.find((t) => t.name.toLowerCase() === query)

    // 2. Tab name contains query or vice versa
    if (!match) {
      match = tabs.find(
        (t) => t.name.toLowerCase().includes(query) || query.includes(t.name.toLowerCase())
      )
    }

    // 3. Cross-language alias matching
    if (!match) {
      const ALIASES: Record<string, string[]> = {
        ai: ['ии', 'аи', 'искусственн', 'нейросет', 'machine', 'ml'],
        crypto: ['крипт', 'биткоин', 'bitcoin', 'btc', 'блокчейн', 'blockchain'],
        economics: ['экономик', 'экономич', 'финанс', 'бизнес', 'economy', 'finance', 'business'],
        russian: ['русск', 'россий', 'россия', 'рф', 'russia', 'новости россии'],
        tech: ['техно', 'технолог', 'technology', 'software', 'програм'],
      }
      for (const tab of tabs) {
        const key = tab.name.toLowerCase()
        const aliases = ALIASES[key] || []
        if (aliases.some((a) => query.includes(a) || a.includes(query))) {
          match = tab
          break
        }
      }
    }

    if (match) {
      resolvedTabId = match.id
      resolvedTabName = match.name
    }
  }

  // If "all" / "все" / "home" — switch to Home (null tab)
  if (/^(все|all|home|домой|главн|all news|все новости)$/i.test(tabName)) {
    resolvedTabId = null
    resolvedTabName = 'Home'
  }

  const stream = new ReadableStream({
    start(controller) {
      const content = `Переключаю на вкладку: ${resolvedTabName}.`
      const evt = {
        id: 'clawdos-news-tab-switch',
        object: 'chat.completion.chunk',
        choices: [{ index: 0, delta: { role: 'assistant', content } }],
      }
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`))
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'navigation', target: '/news' })}\n\n`)
      )
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: 'news.tab.switch', tabId: resolvedTabId, tabName: resolvedTabName })}\n\n`
        )
      )
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })
  return sseResponse(stream)
}

// ---------------------------------------------------------------------------
// Conversation persistence helpers
// ---------------------------------------------------------------------------

/** Ensure a conversation exists (create if needed) and save the user message. */
async function ensureConversation(
  userId: string,
  incomingConversationId: string | null,
  workspaceId: string | null,
  userMessage: string
): Promise<string | null> {
  if (!workspaceId) return null
  try {
    let convId = incomingConversationId
    await withUser(userId, async (client) => {
      if (!convId) {
        const conv = await createConversation(client, {
          workspaceId,
          title: userMessage.slice(0, 80),
        })
        convId = conv.id
      }
      await createMessage(client, { conversationId: convId!, role: 'user', content: userMessage })
    })
    return convId
  } catch (err) {
    console.error('[chat] Failed to persist conversation:', err)
    return incomingConversationId
  }
}

/** Save the assistant's reply after streaming completes. */
async function saveAssistantMessage(userId: string, conversationId: string | null, content: string) {
  if (!conversationId || !content.trim()) return
  try {
    await withUser(userId, (client) =>
      createMessage(client, { conversationId, role: 'assistant', content })
    )
  } catch (err) {
    console.error('[chat] Failed to persist assistant message:', err)
  }
}

// ---------------------------------------------------------------------------
// POST /api/ai/chat
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const session = await getSession()
  if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as
    | {
        message?: string
        conversationId?: string | null
        context?: {
          workspaceId?: string
          workspaceName?: string
          currentPage?: string
        }
        stream?: boolean
      }
    | null

  const message = String(body?.message || '').trim()
  if (!message) return NextResponse.json({ error: 'Missing message' }, { status: 400 })
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: 'Message too long' }, { status: 400 })
  }

  const workspaceId = body?.context?.workspaceId ? String(body.context.workspaceId) : null
  const workspaceName = body?.context?.workspaceName ? String(body.context.workspaceName) : null
  const currentPage = body?.context?.currentPage ? String(body.context.currentPage) : '/'
  const stream = body?.stream !== false

  const encoder = new TextEncoder()

  // Persist conversation + user message
  const conversationId = await ensureConversation(
    session.userId,
    body?.conversationId ?? null,
    workspaceId,
    message
  )

  // --- 3-Layer Intent Router ---
  // Layer 0: regex fast-path (<1ms)
  // Layer 1: embedding semantic match (~6ms)
  // Layer 2: LLM fallback (below)
  const routed = await routeCommand(message, { workspaceId, workspaceName, currentPage })

  if (routed) {
    // Fast-path: persist response text after building it
    const response = await buildFastPathResponse(routed.result, encoder, session.userId, workspaceId)
    // We can't easily extract text from the SSE stream, so save a summary
    saveAssistantMessage(session.userId, conversationId, `[fast-path: ${routed.result.type}]`)
    return response
  }

  // --- Layer 2: No fast-path match → forward to Clawdbot LLM ---

  const telegramUserId = await getTelegramUserIdForSessionUser(session.userId)

  const system = [
    'You are Clawdbot running inside ClawdOS WebUI.',
    'Reply like Telegram/TUI: direct, helpful, no boilerplate.',
    `ClawdOS page: ${currentPage}`,
    `ClawdOS workspace: ${workspaceName ?? workspaceId ?? 'unknown'}`,
    telegramUserId
      ? `Telegram DM target for this user is fixed: ${telegramUserId}. If asked to send a Telegram message, send only to that id.`
      : 'No Telegram user id is linked. If asked to send to Telegram, ask the user to link Telegram in Settings first.',
    '',
    'You can control ClawdOS by embedding action commands in your response.',
    'Format: <clawdos>{"actions":[...]}</clawdos>',
    '',
    'Available actions:',
    '1. Navigate: {"k":"navigate","to":"/tasks"}  (allowed: /today, /news, /tasks, /settings, /settings/telegram, /settings/password)',
    '2. Create task: {"k":"task.create","title":"Task title","description":"Optional","priority":2}',
    '3. Complete task: {"k":"task.complete","taskId":"uuid-here"}',
    '4. Reopen task: {"k":"task.reopen","taskId":"uuid-here"}',
    '5. Delete task: {"k":"task.delete","taskId":"uuid-here"}',
    '6. Add news source: {"k":"news.source.add","url":"https://...","title":"Optional display name","tabs":["TabName1","TabName2"]}',
    '7. Remove news source: {"k":"news.source.remove","sourceId":"uuid-here"}',
    '8. Create news tab: {"k":"news.tab.create","name":"Technology"}',
    '',
    'RSS Feed Catalog (use these URLs when user asks to set up news):',
    '--- AI/ML ---',
    'OpenAI Blog: https://openai.com/blog/rss.xml',
    'MIT Tech Review AI: https://www.technologyreview.com/topic/artificial-intelligence/feed',
    'The Batch (deeplearning.ai): https://www.deeplearning.ai/the-batch/feed/',
    'AI News (Sebastian Raschka): https://magazine.sebastianraschka.com/feed',
    'Hugging Face Blog: https://huggingface.co/blog/feed.xml',
    'arXiv CS.AI: https://rss.arxiv.org/rss/cs.AI',
    'arXiv CS.LG: https://rss.arxiv.org/rss/cs.LG',
    '--- Tech ---',
    'Hacker News: https://news.ycombinator.com/rss',
    'TechCrunch: https://techcrunch.com/feed/',
    'The Verge: https://www.theverge.com/rss/index.xml',
    'Ars Technica: https://feeds.arstechnica.com/arstechnica/index',
    'Wired: https://www.wired.com/feed/rss',
    '--- Crypto ---',
    'CoinDesk: https://www.coindesk.com/arc/outboundfeeds/rss/',
    'Cointelegraph: https://cointelegraph.com/rss',
    'The Block: https://www.theblock.co/rss.xml',
    'Decrypt: https://decrypt.co/feed',
    'Bitcoin Magazine: https://bitcoinmagazine.com/feed',
    '--- Russian News ---',
    'Коммерсантъ: https://www.kommersant.ru/RSS/news.xml',
    'РБК: https://rssexport.rbc.ru/rbcnews/news/30/full.rss',
    'Ведомости: https://www.vedomosti.ru/rss/news',
    'Медуза: https://meduza.io/rss/all',
    'BBC Russian: https://feeds.bbci.co.uk/russian/rss.xml',
    'ТАСС: https://tass.ru/rss/v2.xml',
    'Лента.ру: https://lenta.ru/rss',
    '--- Economy/Finance ---',
    'Bloomberg: https://feeds.bloomberg.com/markets/news.rss',
    'Reuters Business: https://www.reutersagency.com/feed/',
    'Financial Times: https://www.ft.com/rss/home',
    'WSJ Markets: https://feeds.a.dj.com/rss/RSSMarketsMain.xml',
    'Investopedia: https://www.investopedia.com/feedbuilder/feed/getfeed?feedName=rss_headline',
    '',
    'When user asks to set up news, create tabs first, then add sources. Emit ALL actions in ONE <clawdos> block.',
    'Example: user says "настрой новости по AI и крипте" →',
    'Создал вкладки AI и Crypto, добавил источники. Фиды загрузятся в течение минуты.',
    '<clawdos>{"actions":[{"k":"news.tab.create","name":"AI"},{"k":"news.tab.create","name":"Crypto"},{"k":"news.source.add","url":"https://openai.com/blog/rss.xml","title":"OpenAI Blog","tabs":["AI"]},{"k":"news.source.add","url":"https://www.coindesk.com/arc/outboundfeeds/rss/","title":"CoinDesk","tabs":["Crypto"]},{"k":"navigate","to":"/news"}]}</clawdos>',
    'IMPORTANT: Always create tabs BEFORE sources in the actions array. Always include "tabs" in each source with the tab names to assign.',
    '',
    'Important:',
    '- When you execute any action, ALWAYS say what you did in plain text BEFORE the <clawdos> block.',
    '- Put <clawdos> blocks AFTER your human-readable response',
    '- Multiple actions: {"actions":[{...},{...}]}',
    '- You can add many sources at once — they are created instantly, feeds load in background',
    '- Never invent taskIds - if unknown, ask user',
    '- Never reveal secrets (tokens/passwords)',
  ].join('\n')

  const { url, token } = getGateway()

  const upstream = await fetch(`${url}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-clawdbot-agent-id': 'main',
    },
    body: JSON.stringify({
      model: 'clawdbot',
      stream,
      user: `clawdos:${session.userId}${workspaceId ? `:ws:${workspaceId}` : ''}`,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: message },
      ],
    }),
    // Prevent hanging requests if Clawdbot is unresponsive (60 second timeout)
    signal: AbortSignal.timeout(60_000),
  })

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => '')
    return NextResponse.json(
      { error: 'Upstream error', status: upstream.status, detail: text.slice(0, 2000) },
      { status: 502 }
    )
  }

  if (stream) {
    // Process stream: filter <clawdos> blocks and execute actions server-side
    const processedStream = await processStreamWithActions(upstream, session.userId, workspaceId, conversationId)

    return new Response(processedStream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    })
  }

  const json = await upstream.json()
  return NextResponse.json(json)
}

export async function GET(request: Request) {
  const session = await getSession()
  if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const workspaceId = searchParams.get('workspaceId')
  if (!workspaceId) return NextResponse.json({ conversationId: null, messages: [] })

  const conversation = await getActiveConversation(workspaceId, session.userId)
  if (!conversation) return NextResponse.json({ conversationId: null, messages: [] })

  const dbMessages = await withUser(session.userId, (client) =>
    getMessagesByConversation(client, conversation.id)
  )

  const messages = dbMessages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: m.content || '',
    }))

  return NextResponse.json({ conversationId: conversation.id, messages })
}

export async function DELETE(request: Request) {
  const session = await getSession()
  if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const conversationId = body?.conversationId
  if (!conversationId) return NextResponse.json({ error: 'Missing conversationId' }, { status: 400 })

  await withUser(session.userId, (client) =>
    updateConversation(client, conversationId, { status: 'archived' })
  )

  return NextResponse.json({ success: true })
}
