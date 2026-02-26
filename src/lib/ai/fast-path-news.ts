import { withUser } from '@/lib/db'
import { findTabsByWorkspace } from '@/lib/db/repositories/news-tab.repository'
import { sseResponse } from './sse-utils'

export function buildNewsSourcesOpenResponse(encoder: TextEncoder): Response {
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

export function buildNewsSearchResponse(query: string, encoder: TextEncoder): Response {
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

export async function buildNewsTabSwitchResponse(
  tabName: string,
  encoder: TextEncoder,
  userId: string,
  workspaceId: string | null
): Promise<Response> {
  // Resolve tab from DB with fuzzy matching
  let resolvedTabId: string | null = null
  let resolvedTabName = tabName

  if (workspaceId) {
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
