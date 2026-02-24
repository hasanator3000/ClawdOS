import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { withUser } from '@/lib/db'
import type { CommandResult } from '@/lib/commands/chat-handlers'
import { getWorkspacesForUser } from '@/lib/workspace'
import { ACTIVE_WORKSPACE_COOKIE } from '@/lib/constants'
import { createTask as createTaskRepo } from '@/lib/db/repositories/task.repository'
import { findTabsByWorkspace } from '@/lib/db/repositories/news-tab.repository'

/**
 * Build fast-path SSE response from a CommandResult
 */
export function buildFastPathResponse(
  result: CommandResult,
  userId: string,
  workspaceId: string | null
): Response | Promise<Response> {
  const encoder = new TextEncoder()

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

/**
 * Helper to create SSE response with proper headers
 */
export function sseResponse(body: ReadableStream): Response {
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
