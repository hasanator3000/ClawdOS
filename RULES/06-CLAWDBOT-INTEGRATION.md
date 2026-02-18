# 06 — Clawdbot Integration

## Architecture

```
Browser  ──POST /api/ai/chat──>  Next.js API  ──POST /v1/chat/completions──>  Clawdbot Gateway
         <──SSE stream──────────               <──SSE stream────────────────
```

- ClawdOS is the **UI + DB + RLS layer**
- Clawdbot is the **agent runtime** (separate repo, separate process)
- Communication: HTTP over loopback (`127.0.0.1:18789`)
- Auth: `Authorization: Bearer ${CLAWDBOT_TOKEN}` (server-side only)

## Integration points

### 1. Web chat proxy — `POST /api/ai/chat`

**File:** `src/app/api/ai/chat/route.ts`

**Flow:**
1. Browser sends message to `/api/ai/chat`
2. Server validates session, gets workspace context
3. **3-layer intent router** tries to handle without LLM:
   - Layer 0: Regex fast-path (<1ms) — task create, navigate, workspace switch
   - Layer 1: Embedding semantic match (~6ms) — via `@xenova/transformers`
   - Layer 2: LLM fallback — proxy to Clawdbot
4. If fast-path: build SSE response directly
5. If LLM: proxy to Clawdbot with system prompt containing:
   - Current page, workspace name
   - Available actions with syntax
   - RSS feed catalog (for news setup)
   - User's Telegram link status
6. Stream response back, parsing `<clawdos>{...}</clawdos>` action blocks
7. Execute actions server-side under RLS
8. Send refresh events to client

### 2. Consult endpoint — `POST /api/consult`

**File:** `src/app/api/consult/route.ts`

**Purpose:** Meta-queries about ClawdOS architecture (used by coding agents before making changes).

**Auth:** Session OR `x-clawdos-consult-token` header

### 3. Simple passthrough — `POST /api/assistant`

**File:** `src/app/api/assistant/route.ts`

**Purpose:** Direct proxy to Clawdbot without action processing.

## Action protocol

### Format

Clawdbot embeds actions in its response text using XML-like tags:

```
Here's what I did:
<clawdos>{"actions":[{"k":"task.create","title":"Buy groceries","priority":2}]}</clawdos>
I've created the task for you.
```

### Current action whitelist

| Action key | Parameters | Description |
|-----------|-----------|-------------|
| `navigate` | `to: string` | Navigate to a page (must be in whitelist) |
| `task.create` | `title, description?, priority?` | Create new task |
| `task.complete` | `taskId` | Mark task as done |
| `task.reopen` | `taskId` | Reopen completed task |
| `task.delete` | `taskId` | Delete task |
| `news.source.add` | `url, title?, tabs?[]` | Add RSS source |
| `news.source.remove` | `sourceId` | Remove RSS source |
| `news.tab.create` | `name` | Create news tab |

### Navigation whitelist

```typescript
const NAV_WHITELIST = ['/today', '/news', '/tasks', '/settings', '/settings/telegram', '/settings/password']
```

### Adding a new action

1. Add handler in `executeActions()` switch in `src/app/api/ai/chat/route.ts`
2. Add to system prompt action list (same file, `buildSystemPrompt()`)
3. Add event type if needed (e.g., `<section>.refresh`)
4. Add fast-path regex in `src/lib/commands/chat-handlers.ts` (optional)

## Client-side event handling

Actions executed on the server send SSE events back to the client:

```typescript
// Server sends:
{ type: 'task.refresh', actions: [{ action: 'task.create', taskId: '...', task: {...} }] }

// Client listens:
window.addEventListener('clawdos:task-refresh', (e: CustomEvent) => {
  // Update local state with e.detail.actions
})
```

### Adding event support for a new section

1. In `processStreamWithActions()`, after executing actions, emit SSE event:
```typescript
controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: '<section>.refresh', actions: results })}\n\n`))
```

2. In client component, listen for the event:
```typescript
useEffect(() => {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail
    // Update state from detail.actions
  }
  window.addEventListener('clawdos:<section>-refresh', handler)
  return () => window.removeEventListener('clawdos:<section>-refresh', handler)
}, [])
```

## System prompt structure

The system prompt sent to Clawdbot includes:

```
You are Clawdbot running inside ClawdOS WebUI.
ClawdOS page: <current page>
ClawdOS workspace: <workspace name>

You can control ClawdOS by embedding action commands in your response.
Action format: <clawdos>{"actions":[...]}</clawdos>

Available actions:
1. Navigate: {"k":"navigate","to":"/tasks"}
2. Create task: {"k":"task.create","title":"...","description":"...","priority":2}
...
```

When adding a new section with actions, add to this prompt.

## Gateway configuration

```typescript
const url = process.env.CLAWDBOT_URL || 'http://127.0.0.1:18789'
const token = process.env.CLAWDBOT_TOKEN  // Required, throws if missing
```

**Request to Clawdbot:**
```json
{
  "model": "clawdbot",
  "stream": true,
  "user": "clawdos:<userId>:ws:<workspaceId>",
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ]
}
```

## Anti-patterns (DO NOT)

- **DO NOT** call Clawdbot from client-side code — always proxy through Next.js API
- **DO NOT** expose `CLAWDBOT_TOKEN` or `CLAWDBOT_URL` to the browser
- **DO NOT** add Telegram bot/webhook handling in ClawdOS — that's Clawdbot's domain
- **DO NOT** install `@anthropic-ai/sdk` or any LLM SDK — Clawdbot is the only runtime
- **DO NOT** add actions without adding them to the whitelist
- **DO NOT** execute arbitrary model-provided DOM selectors — only whitelisted action keys
- **DO NOT** modify Clawdbot's internal configuration from ClawdOS code
