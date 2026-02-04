import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { withUser } from '@/lib/db'
import { resolveSectionPath, sectionLabel } from '@/lib/nav/resolve'
import {
  createTask as createTaskRepo,
  completeTask as completeTaskRepo,
  reopenTask as reopenTaskRepo,
  deleteTask as deleteTaskRepo,
} from '@/lib/db/repositories/task.repository'

export const dynamic = 'force-dynamic'

const MAX_MESSAGE_LENGTH = 10_000

function detectNavigationTarget(message: string): string | null {
  const resolved = resolveSectionPath(message)
  if (resolved && ALLOWED_PATHS.has(resolved)) return resolved
  return null
}

type TasksFilter = 'active' | 'completed' | 'all'

function detectTasksFilterTarget(message: string): TasksFilter | null {
  const m = message.toLowerCase().trim()

  // ru
  if (/(выполнен|сделан|completed)/.test(m)) return 'completed'
  if (/(активн|текущ|active)/.test(m)) return 'active'
  if (/(все|all)/.test(m) && /(таск|задач|tasks?)/.test(m)) return 'all'

  // if message is just "all" we ignore (too ambiguous)
  return null
}

function extractTaskTitle(message: string): string | null {
  const m = message.trim()

  // Common RU patterns:
  // "создай задачу купить молоко"
  // "добавь таск: купить молоко"
  const ru = m.match(/^(создай|добавь)\s+(задач[ауи]?|таск)\s*[:\-—]?\s*(.+)$/i)
  if (ru) return ru[3].trim().replace(/^"|"$/g, '')

  // EN patterns:
  const en = m.match(/^(create|add)\s+(a\s+)?task\s*[:\-—]?\s*(.+)$/i)
  if (en) return en[3].trim().replace(/^"|"$/g, '')

  return null
}

// navLabel removed; use sectionLabel() from nav registry

// Whitelisted navigation paths
const ALLOWED_PATHS = new Set([
  '/today',
  '/news',
  '/tasks',
  '/settings',
  // Settings sub-pages
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
  }

  return { navigation: navigationTarget, results }
}

// Process stream: filter <lifeos> blocks, execute actions, stream clean text
async function processStreamWithActions(
  upstreamResponse: Response,
  userId: string,
  workspaceId: string | null
): Promise<ReadableStream> {
  const reader = upstreamResponse.body?.getReader()
  if (!reader) throw new Error('No upstream body')

  const decoder = new TextDecoder()
  const encoder = new TextEncoder()

  let fullAssistantText = '' // Accumulate full text for action parsing
  let buffer = ''

  return new ReadableStream({
    async start(controller) {
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
                const matches = Array.from(fullAssistantText.matchAll(/<lifeos>([\s\S]*?)<\/lifeos>/g))
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
                      console.log('[LifeOS] Executing actions:', actions)
                      const result = await executeActions(actions, userId, workspaceId)
                      console.log('[LifeOS] Actions result:', result)

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
                // Accumulate full text
                fullAssistantText += delta.content

                // Filter out <lifeos> blocks from displayed content
                const filtered = filterLifeosBlocks(delta.content)

                // Send filtered delta to client
                if (filtered) {
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
      } finally {
        controller.close()
      }
    },
  })
}

// Simple filter: remove <lifeos>...</lifeos> blocks (handles complete blocks only)
// For cross-chunk split handling, client-side filtering remains as fallback
function filterLifeosBlocks(text: string): string {
  return text.replace(/<lifeos>[\s\S]*?<\/lifeos>/g, '')
}

// POST /api/ai/chat
// Safe server-side proxy to Clawdbot Gateway OpenAI-compatible endpoint.
// Security properties:
// - never exposes gateway token to the browser
// - requires LifeOS session
// - streams SSE back to the client
// - passes a *whitelisted* Telegram target (if linked) so the agent can message TG without asking for ids
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

  const telegramUserId = await getTelegramUserIdForSessionUser(session.userId)

  // Fast-path: deterministic navigation for common "open tab" commands.
  // This makes navigation reliable even if the model fails to emit <lifeos> blocks.
  const navTarget = detectNavigationTarget(message)

  // Fast-path: quick task creation (deterministic) for "create/add task ..." commands.
  const quickTitle = extractTaskTitle(message)

  if (quickTitle) {
    if (!workspaceId) return NextResponse.json({ error: 'No workspace selected' }, { status: 400 })

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const task = await withUser(session.userId!, async (client) => {
            return createTaskRepo(client, { title: quickTitle, workspaceId })
          })

          const content = `Создал задачу: ${task.title}.`
          const evt = {
            id: 'lifeos-task-create',
            object: 'chat.completion.chunk',
            choices: [{ index: 0, delta: { role: 'assistant', content } }],
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`))

          // Update task lists immediately
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'task.refresh', actions: [{ action: 'task.create', taskId: task.id, task }] })}\n\n`
            )
          )

          // If the user implicitly asked for tasks view, navigate; otherwise refresh widgets.
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'navigation', target: '/tasks' })}\n\n`))

          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (err) {
          const evt = {
            id: 'lifeos-task-create-error',
            object: 'chat.completion.chunk',
            choices: [{ index: 0, delta: { role: 'assistant', content: 'Не смог создать задачу.' } }],
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`))
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        }
      },
    })

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    })
  }

  if (navTarget) {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        const content = `Открыл раздел: ${sectionLabel(navTarget)}.`
        const evt = {
          id: 'lifeos-nav',
          object: 'chat.completion.chunk',
          choices: [{ index: 0, delta: { role: 'assistant', content } }],
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`))
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'navigation', target: navTarget })}\n\n`)
        )
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    })
  }

  const system = [
    'You are Clawdbot running inside LifeOS WebUI.',
    'Reply like Telegram/TUI: direct, helpful, no boilerplate.',
    `LifeOS page: ${currentPage}`,
    `LifeOS workspace: ${workspaceName ?? workspaceId ?? 'unknown'}`,
    telegramUserId
      ? `Telegram DM target for this user is fixed: ${telegramUserId}. If asked to send a Telegram message, send only to that id.`
      : 'No Telegram user id is linked. If asked to send to Telegram, ask the user to link Telegram in Settings first.',
    '',
    'You can control LifeOS by embedding action commands in your response.',
    'Format: <lifeos>{"actions":[...]}</lifeos>',
    '',
    'Available actions:',
    '1. Navigate: {"k":"navigate","to":"/tasks"}  (allowed: /today, /news, /tasks, /settings, /settings/telegram, /settings/password)',
    '2. Create task: {"k":"task.create","title":"Task title","description":"Optional","priority":2}',
    '3. Complete task: {"k":"task.complete","taskId":"uuid-here"}',
    '4. Reopen task: {"k":"task.reopen","taskId":"uuid-here"}',
    '5. Delete task: {"k":"task.delete","taskId":"uuid-here"}',
    '',
    'Examples:',
    '- User: "открой таски" → You: "Opening tasks page <lifeos>{\\"actions\\":[{\\"k\\":\\"navigate\\",\\"to\\":\\"/tasks\\"}]}</lifeos>"',
    '- User: "создай задачу купить молоко" → You: "Created task <lifeos>{\\"actions\\":[{\\"k\\":\\"task.create\\",\\"title\\":\\"Купить молоко\\"},{\\"k\\":\\"navigate\\",\\"to\\":\\"/tasks\\"}]}</lifeos>"',
    '',
    'Important:',
    '- When you execute any action (navigate / task.*), ALWAYS say what you did in plain text (e.g., "Открыл Tasks" / "Создал задачу ...").',
    '- Put <lifeos> blocks AFTER your human-readable response',
    '- Multiple actions: {"actions":[{...},{...}]}',
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
      user: `lifeos:${session.userId}${workspaceId ? `:ws:${workspaceId}` : ''}`,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: message },
      ],
    }),
  })

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => '')
    return NextResponse.json(
      { error: 'Upstream error', status: upstream.status, detail: text.slice(0, 2000) },
      { status: 502 }
    )
  }

  if (stream) {
    // Process stream: filter <lifeos> blocks and execute actions server-side
    const processedStream = await processStreamWithActions(upstream, session.userId, workspaceId)

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

export async function GET() {
  return NextResponse.json({ error: 'Not implemented' }, { status: 501 })
}
