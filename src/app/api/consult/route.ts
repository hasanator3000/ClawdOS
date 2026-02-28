import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { getSession } from '@/lib/auth/session'
import { formatZodErrors } from '@/lib/validation'
import { consultQuestionSchema } from '@/lib/validation-schemas'

export const dynamic = 'force-dynamic'

function getGateway() {
  const url = process.env.CLAWDBOT_URL || 'http://127.0.0.1:18789'
  const token = process.env.CLAWDBOT_TOKEN
  if (!token) throw new Error('CLAWDBOT_TOKEN is not set')
  return { url: url.replace(/\/$/, ''), token }
}

function readOptional(rel: string) {
  try {
    return fs.readFileSync(path.join(process.cwd(), rel), 'utf8')
  } catch {
    return ''
  }
}

export async function POST(req: Request) {
  const session = await getSession()

  const consultToken = process.env.CLAWDOS_CONSULT_TOKEN
  const headerToken = req.headers.get('x-clawdos-consult-token')

  const authed = Boolean(session.userId) || (consultToken && headerToken === consultToken)
  if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON', fields: {} }, { status: 400 })

  const parsed = consultQuestionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', fields: formatZodErrors(parsed.error) }, { status: 400 })
  }

  const { question } = parsed.data

  const manifest = readOptional('docs/AGENT_MANIFEST.md')
  const capabilities = readOptional('docs/capabilities.json')
  const rules = readOptional('CODING_AGENT_RULES.md')

  const system = [
    'You are the Clawdbot project inspector for the ClawdOS repository.',
    'Your job is to answer whether something already exists, where it lives in the codebase, and the safest correct integration path.',
    'Be concise and actionable. Prefer bullet points.',
    'Respect security rules: do not suggest direct Claude/Anthropic API calls from ClawdOS; do not suggest Telegram webhook/bot in ClawdOS; do not suggest DOM selector click actions from model output; never leak tokens.',
    '',
    '=== AGENT_MANIFEST.md ===',
    manifest || '(missing)',
    '',
    '=== capabilities.json ===',
    capabilities || '(missing)',
    '',
    '=== CODING_AGENT_RULES.md ===',
    rules || '(missing)',
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
      stream: false,
      user: `clawdos-consult:${session.userId || 'token'}`,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: question },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => '')
    return NextResponse.json(
      { error: 'Upstream error', status: upstream.status, detail: text.slice(0, 2000) },
      { status: 502 }
    )
  }

  const json = (await upstream.json().catch(() => null)) as { choices?: Array<{ message?: { content?: unknown } }> } | null
  const answer = json?.choices?.[0]?.message?.content
  return NextResponse.json({ answer: typeof answer === 'string' ? answer : '' })
}
