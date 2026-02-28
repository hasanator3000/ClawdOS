import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { withUser } from '@/lib/db'
import { routeCommand } from '@/lib/intents/router'
import { withCircuitBreaker } from '@/lib/circuit-breaker'
import { createLogger } from '@/lib/logger'
import { formatZodErrors } from '@/lib/validation'
import { chatMessageSchema, chatDeleteSchema } from '@/lib/validation-schemas'
import {
  getActiveConversation,
  getMessagesByConversation,
  updateConversation,
} from '@/lib/ai/repository'
import { executeActions } from '@/lib/ai/actions-executor'
import { processStreamWithActions } from '@/lib/ai/stream-processor'
import { buildFastPathResponse } from '@/lib/ai/fast-path-builders'
import { ensureConversation, saveAssistantMessage } from '@/lib/ai/conversation'
import { loadWebUIRules } from '@/lib/ai/agent-rules-loader'
import { getGateway, getTelegramUserIdForSessionUser } from '../utils/gateway'

const log = createLogger('ai-chat')

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const session = await getSession()
  if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON', fields: {} }, { status: 400 })

  const parsed = chatMessageSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', fields: formatZodErrors(parsed.error) }, { status: 400 })
  }

  const { message, context, stream: streamOpt } = parsed.data
  const workspaceId = context?.workspaceId ?? null
  const workspaceName = context?.workspaceName ?? null
  const currentPage = context?.currentPage ?? '/'
  const stream = streamOpt !== false

  // Persist conversation + user message
  const conversationId = await ensureConversation(
    session.userId,
    parsed.data.conversationId ?? null,
    workspaceId,
    message
  )

  // --- 3-Layer Intent Router ---
  // Layer 0: regex fast-path (<1ms)
  // Layer 1: embedding semantic match (~6ms)
  // Layer 2: LLM fallback (below)
  const routed = await routeCommand(message, { workspaceId, workspaceName, currentPage })

  if (routed) {
    log.info('Fast-path triggered', {
      message,
      layer: routed.layer,
      intentId: routed.intentId,
      resultType: routed.result.type,
    })
    // Fast-path: persist response text after building it
    const response = await buildFastPathResponse(routed.result, session.userId, workspaceId)
    // We can't easily extract text from the SSE stream, so save a summary
    saveAssistantMessage(session.userId, conversationId, `[fast-path: ${routed.result.type}]`)
    return response
  }

  // --- Layer 2: No fast-path match → forward to Clawdbot LLM ---

  const [telegramUserId, agentRules] = await Promise.all([
    getTelegramUserIdForSessionUser(session.userId),
    loadWebUIRules(),
  ])

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
    '1. Navigate: {"k":"navigate","to":"/tasks"}  (allowed: /today, /news, /tasks, /deliveries, /settings, /settings/telegram, /settings/password)',
    '2. Create task: {"k":"task.create","title":"Task title","description":"Optional","priority":2}',
    '3. Complete task: {"k":"task.complete","taskId":"uuid-here"}',
    '4. Reopen task: {"k":"task.reopen","taskId":"uuid-here"}',
    '5. Delete task: {"k":"task.delete","taskId":"uuid-here"}',
    '6. Update task priority: {"k":"task.priority","taskId":"uuid-here","priority":3}  (priority: 0=none, 1=low, 2=medium, 3=high, 4=urgent)',
    '7. Add news source: {"k":"news.source.add","url":"https://...","title":"Optional display name","tabs":["TabName1","TabName2"]}',
    '8. Remove news source: {"k":"news.source.remove","sourceId":"uuid-here"}',
    '9. Create news tab: {"k":"news.tab.create","name":"Technology"}',
    '10. Track delivery: {"k":"delivery.track","trackingNumber":"1Z999AA10123456784","title":"Optional name"}',
    '11. Remove delivery: {"k":"delivery.remove","deliveryId":"uuid-here"}',
    '12. List deliveries: {"k":"delivery.list","status":"transit"} (status optional, omit for all active)',
    '13. Get delivery status: {"k":"delivery.status","trackingNumber":"1Z999..."} (or use "deliveryId":"uuid")',
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
    ...(agentRules ? ['', 'Section behavior rules (loaded from agent files):', agentRules] : []),
  ].join('\n')

  const { url, token } = getGateway()

  let upstream: Response
  try {
    upstream = await withCircuitBreaker(
      { name: 'clawdbot', failureThreshold: 5, resetTimeout: 30_000 },
      async () => {
        const res = await fetch(`${url}/v1/chat/completions`, {
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
          signal: AbortSignal.timeout(60_000),
        })
        if (!res.ok) throw new Error(`Upstream HTTP ${res.status}`)
        return res
      }
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.error('Clawdbot upstream failed', { error: msg })
    if (msg.startsWith('Circuit open:')) {
      return NextResponse.json(
        { error: 'AI service temporarily unavailable. Please try again shortly.' },
        { status: 503 }
      )
    }
    return NextResponse.json(
      { error: 'Upstream error', detail: msg.slice(0, 2000) },
      { status: 502 }
    )
  }

  if (stream) {
    // Process stream: filter <clawdos> blocks and execute actions server-side
    const processedStream = await processStreamWithActions(
      upstream,
      session.userId,
      workspaceId,
      conversationId,
      executeActions,
      saveAssistantMessage
    )

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
  if (!body) return NextResponse.json({ error: 'Invalid JSON', fields: {} }, { status: 400 })

  const parsed = chatDeleteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', fields: formatZodErrors(parsed.error) }, { status: 400 })
  }

  await withUser(session.userId, (client) =>
    updateConversation(client, parsed.data.conversationId, { status: 'archived' })
  )

  return NextResponse.json({ success: true })
}
