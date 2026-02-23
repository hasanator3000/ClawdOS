// SSE stream parsing and display filtering for chat — no React dependency

// --------------------------------------------------------------------------
// Display filter: strips <clawdos>...</clawdos> blocks from streaming text
// --------------------------------------------------------------------------

export interface DisplayFilter {
  /** Feed a streaming delta and return visible text (clawdos blocks stripped). */
  feed(delta: string): string
  /** Flush any remaining buffer (call when stream ends). Returns visible text. */
  flush(): string
}

export function createDisplayFilter(): DisplayFilter {
  let displayBuffer = ''
  let inClawdosBlock = false

  function feed(delta: string): string {
    if (!delta) return ''

    displayBuffer += delta
    let visibleDelta = ''

    while (displayBuffer.length > 0) {
      if (!inClawdosBlock) {
        const openIdx = displayBuffer.indexOf('<clawdos>')

        if (openIdx === -1) {
          // Check if buffer ends with partial tag start
          let keepLen = 0
          for (let len = Math.min(7, displayBuffer.length); len > 0; len--) {
            if ('<clawdos>'.startsWith(displayBuffer.slice(-len))) {
              keepLen = len
              break
            }
          }

          if (keepLen > 0) {
            visibleDelta += displayBuffer.slice(0, -keepLen)
            displayBuffer = displayBuffer.slice(-keepLen)
            break
          } else {
            visibleDelta += displayBuffer
            displayBuffer = ''
            break
          }
        } else {
          visibleDelta += displayBuffer.slice(0, openIdx)
          displayBuffer = displayBuffer.slice(openIdx + 8) // Skip '<clawdos>'
          inClawdosBlock = true
        }
      } else {
        const closeIdx = displayBuffer.indexOf('</clawdos>')

        if (closeIdx === -1) {
          let keepLen = 0
          for (let len = Math.min(8, displayBuffer.length); len > 0; len--) {
            if ('</clawdos>'.startsWith(displayBuffer.slice(-len))) {
              keepLen = len
              break
            }
          }

          if (keepLen > 0) {
            displayBuffer = displayBuffer.slice(-keepLen)
            break
          } else {
            displayBuffer = ''
            break
          }
        } else {
          displayBuffer = displayBuffer.slice(closeIdx + 9) // Skip '</clawdos>'
          inClawdosBlock = false
        }
      }
    }

    return visibleDelta
  }

  function flush(): string {
    if (!inClawdosBlock && displayBuffer) {
      const remaining = displayBuffer
      displayBuffer = ''
      return remaining
    }
    displayBuffer = ''
    return ''
  }

  return { feed, flush }
}

// --------------------------------------------------------------------------
// SSE buffer parsing: split raw SSE text into individual data frames
// --------------------------------------------------------------------------

export interface SSEParseResult {
  frames: string[]
  remainder: string
}

/** Parse raw SSE buffer into individual data payloads. */
export function parseSSEBuffer(buffer: string): SSEParseResult {
  const chunks = buffer.split('\n\n')
  const remainder = chunks.pop() || ''
  const frames: string[] = []

  for (const frame of chunks) {
    const dataLines = frame
      .split('\n')
      .filter((l) => l.startsWith('data: '))
      .map((l) => l.slice(6).trim())

    for (const data of dataLines) {
      if (data) frames.push(data)
    }
  }

  return { frames, remainder }
}

// --------------------------------------------------------------------------
// Chat event types and parsing
// --------------------------------------------------------------------------

export type ChatEvent =
  | { type: 'conversationId'; id: string }
  | { type: 'navigation'; target: string }
  | { type: 'tasks.filter'; value: string }
  | { type: 'task.refresh'; actions: unknown }
  | { type: 'news.refresh'; actions: unknown }
  | { type: 'news.sources.open' }
  | { type: 'news.tab.switch'; tabId?: string; tabName?: string }
  | { type: 'workspace.switch'; workspaceId: string }
  | { type: 'delta'; content: string }
  | { type: 'done' }
  | { type: 'unknown' }

/** Parse a single SSE data string into a typed ChatEvent. */
export function parseChatEvent(data: string): ChatEvent {
  if (data === '[DONE]') return { type: 'done' }

  let evt: Record<string, unknown>
  try {
    evt = JSON.parse(data)
  } catch {
    return { type: 'unknown' }
  }

  if (evt?.type === 'conversationId' && evt?.id) {
    return { type: 'conversationId', id: String(evt.id) }
  }
  if (evt?.type === 'navigation' && evt?.target) {
    return { type: 'navigation', target: String(evt.target) }
  }
  if (evt?.type === 'tasks.filter' && evt?.value) {
    return { type: 'tasks.filter', value: String(evt.value) }
  }
  if (evt?.type === 'task.refresh') {
    return { type: 'task.refresh', actions: evt.actions }
  }
  if (evt?.type === 'news.refresh') {
    return { type: 'news.refresh', actions: evt.actions }
  }
  if (evt?.type === 'news.sources.open') {
    return { type: 'news.sources.open' }
  }
  if (evt?.type === 'news.tab.switch') {
    return {
      type: 'news.tab.switch',
      tabId: evt.tabId != null ? String(evt.tabId) : undefined,
      tabName: evt.tabName ? String(evt.tabName) : undefined,
    }
  }
  if (evt?.type === 'workspace.switch' && evt?.workspaceId) {
    return { type: 'workspace.switch', workspaceId: String(evt.workspaceId) }
  }

  // OpenAI chat.completions streaming shape
  const choice = (evt as Record<string, unknown>)?.choices as Array<Record<string, unknown>> | undefined
  const delta = choice?.[0]?.delta as Record<string, unknown> | undefined
  if (typeof delta?.content === 'string') {
    return { type: 'delta', content: delta.content }
  }

  return { type: 'unknown' }
}

// --------------------------------------------------------------------------
// Chat event side-effect dispatch
// --------------------------------------------------------------------------

export interface DispatchDeps {
  currentPage: string
  scheduleRefresh: () => void
  setPendingNavigation: (target: string) => void
}

/** Handle side effects for a parsed chat event. Returns nothing — mutates external state via deps. */
export function dispatchChatEvent(event: ChatEvent, deps: DispatchDeps): void {
  switch (event.type) {
    case 'navigation':
      deps.setPendingNavigation(event.target)
      break

    case 'tasks.filter':
      window.dispatchEvent(new CustomEvent('clawdos:tasks-filter', { detail: { value: event.value } }))
      if (deps.currentPage !== '/tasks') {
        deps.setPendingNavigation('/tasks')
      }
      break

    case 'task.refresh':
      window.dispatchEvent(new CustomEvent('clawdos:task-refresh', { detail: { actions: event.actions } }))
      deps.scheduleRefresh()
      break

    case 'news.refresh':
      window.dispatchEvent(new CustomEvent('clawdos:news-refresh', { detail: { actions: event.actions } }))
      deps.scheduleRefresh()
      break

    case 'news.sources.open':
      window.dispatchEvent(new CustomEvent('clawdos:news-sources-open'))
      if (deps.currentPage !== '/news') {
        deps.setPendingNavigation('/news')
      }
      break

    case 'news.tab.switch':
      window.dispatchEvent(
        new CustomEvent('clawdos:news-tab-switch', {
          detail: { tabId: event.tabId, tabName: event.tabName },
        })
      )
      break

    case 'workspace.switch':
      window.dispatchEvent(
        new CustomEvent('clawdos:workspace-switch', { detail: { workspaceId: event.workspaceId } })
      )
      deps.scheduleRefresh()
      break

    // conversationId, delta, done, unknown — handled by caller directly
    default:
      break
  }
}
