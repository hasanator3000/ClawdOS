import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

const MAX_MESSAGE_LENGTH = 10_000

function getGateway() {
  const url = process.env.CLAWDBOT_URL || 'http://127.0.0.1:18789'
  const token = process.env.CLAWDBOT_TOKEN
  if (!token) throw new Error('CLAWDBOT_TOKEN is not set')
  return { url: url.replace(/\/$/, ''), token }
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session.userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = (await req.json().catch(() => null)) as
    | {
        message?: string
        workspaceId?: string | null
        conversationId?: string | null
        stream?: boolean
      }
    | null

  const message = String(body?.message || '').trim()
  if (!message) return NextResponse.json({ error: 'empty_message' }, { status: 400 })
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: 'message_too_long' }, { status: 400 })
  }

  const workspaceId = body?.workspaceId ? String(body.workspaceId) : null
  const stream = body?.stream !== false

  const { url, token } = getGateway()

  const upstream = await fetch(`${url}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      // Pin the agent used by the gateway.
      'x-clawdbot-agent-id': 'main',
    },
    body: JSON.stringify({
      model: 'clawdbot',
      stream,
      // Stable session key derivation inside the gateway.
      user: `lifeos:${session.userId}${workspaceId ? `:ws:${workspaceId}` : ''}`,
      messages: [{ role: 'user', content: message }],
    }),
  })

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => '')
    return NextResponse.json(
      {
        error: 'upstream_error',
        status: upstream.status,
        detail: text.slice(0, 2000),
      },
      { status: 502 }
    )
  }

  // Streaming SSE passthrough
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

  // Non-stream JSON
  const json = await upstream.json()
  return NextResponse.json(json)
}
