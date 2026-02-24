import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { formatZodErrors } from '@/lib/validation'
import { assistantMessageSchema } from '@/lib/validation-schemas'

export const dynamic = 'force-dynamic'

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

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON', fields: {} }, { status: 400 })

  const parsed = assistantMessageSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', fields: formatZodErrors(parsed.error) }, { status: 400 })
  }

  const { message, workspaceId: wsId, stream: streamOpt } = parsed.data
  const workspaceId = wsId ?? null
  const stream = streamOpt !== false

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
      user: `clawdos:${session.userId}${workspaceId ? `:ws:${workspaceId}` : ''}`,
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
