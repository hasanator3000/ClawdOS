import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { withUser } from '@/lib/db'

export const dynamic = 'force-dynamic'

const MAX_MESSAGE_LENGTH = 10_000

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

  const system = [
    'You are Clawdbot running inside LifeOS WebUI.',
    'Reply like Telegram/TUI: direct, helpful, no boilerplate.',
    `LifeOS page: ${currentPage}`,
    `LifeOS workspace: ${workspaceName ?? workspaceId ?? 'unknown'}`,
    telegramUserId
      ? `Telegram DM target for this user is fixed: ${telegramUserId}. If asked to send a Telegram message, send only to that id.`
      : 'No Telegram user id is linked. If asked to send to Telegram, ask the user to link Telegram in Settings first.',
    '',
    'You have tools to control LifeOS:',
    '- navigate_page(page): Navigate to /today, /news, /tasks, or /settings',
    '- create_task(title, description?, priority?): Create a new task',
    '- complete_task(taskId): Mark task as done',
    '- reopen_task(taskId): Reopen a completed task',
    '',
    'When the user asks you to do something (open a page, create a task, etc.), USE THE TOOLS silently.',
    'Your text response should be natural language only, like: "Opening tasks page" or "Created task: Buy milk".',
    'Do NOT write code or JSON in your response - just call the tools and describe what you did.',
    'Do not invent taskIds - if you need one, ask the user to tell you which task.',
    '',
    'Never reveal any secrets (tokens/passwords/keys).',
  ].join('\n')

  const { url, token } = getGateway()

  // Define tools for Clawdbot (OpenAI-compatible format)
  const tools = [
    {
      type: 'function',
      function: {
        name: 'navigate_page',
        description: 'Navigate to a different page in LifeOS',
        parameters: {
          type: 'object',
          properties: {
            page: {
              type: 'string',
              enum: ['/today', '/news', '/tasks', '/settings'],
              description: 'The page to navigate to',
            },
          },
          required: ['page'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'create_task',
        description: 'Create a new task',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Task title' },
            description: { type: 'string', description: 'Optional task description' },
            priority: { type: 'number', minimum: 0, maximum: 4, description: 'Priority 0-4' },
          },
          required: ['title'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'complete_task',
        description: 'Mark a task as completed',
        parameters: {
          type: 'object',
          properties: {
            taskId: { type: 'string', format: 'uuid', description: 'Task UUID' },
          },
          required: ['taskId'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'reopen_task',
        description: 'Reopen a completed task',
        parameters: {
          type: 'object',
          properties: {
            taskId: { type: 'string', format: 'uuid', description: 'Task UUID' },
          },
          required: ['taskId'],
        },
      },
    },
  ]

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
      tools,
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
    return new Response(upstream.body, {
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
