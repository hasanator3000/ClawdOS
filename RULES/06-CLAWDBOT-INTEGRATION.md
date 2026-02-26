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

**Key file references:**
- Action execution: `src/lib/ai/actions-executor.ts`
- Stream processing: `src/lib/ai/stream-processor.ts`
- Fast-path builders: `src/lib/ai/fast-path-builders.ts` + `src/lib/ai/fast-path-news.ts`
- Intent router: `src/lib/intents/router.ts`
- Regex fast-paths: `src/lib/commands/chat-handlers.ts`
- Embedding layer: `src/lib/intents/embeddings.ts`
- Intent cards: `src/lib/intents/cards.ts`
- SSE utilities: `src/lib/ai/sse-utils.ts`
- Conversation persistence: `src/lib/ai/conversation.ts`
- Circuit breaker: `src/lib/circuit-breaker.ts`

**Flow:**
1. Browser sends message to `/api/ai/chat`
2. Server validates session, parses with `chatMessageSchema` from `validation-schemas.ts`
3. Persists conversation + user message via `ensureConversation()`
4. **3-layer intent router** (`src/lib/intents/router.ts`) tries to handle without LLM:
   - Layer 0: Regex fast-path (<1ms) — `src/lib/commands/chat-handlers.ts` — task create, navigate, workspace switch, news operations
   - Layer 1: Embedding semantic match (~6ms) — `src/lib/intents/embeddings.ts` via `@xenova/transformers`
   - Layer 2: LLM fallback — proxy to Clawdbot (external gateway)
5. If fast-path (Layer 0 or 1): `src/lib/ai/fast-path-builders.ts` builds SSE response directly
6. If LLM: proxy to Clawdbot via `withCircuitBreaker()` with system prompt containing:
   - Current page, workspace name
   - Available actions with syntax (11 actions)
   - RSS feed catalog (for news setup)
   - User's Telegram link status
7. `src/lib/ai/stream-processor.ts` streams response back, parsing `<clawdos>{...}</clawdos>` action blocks
8. `src/lib/ai/actions-executor.ts` executes actions server-side under RLS
9. Stream processor sends refresh events to client (`task.refresh`, `news.refresh`, `delivery.refresh`)

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

### Current action whitelist (11 actions)

**File:** `src/lib/ai/actions-executor.ts`

| Action key | Parameters | Description |
|-----------|-----------|-------------|
| `navigate` | `to: string` | Navigate to a page (must be in ALLOWED_PATHS) |
| `task.create` | `title, description?, priority?` | Create new task |
| `task.complete` | `taskId` | Mark task as done |
| `task.reopen` | `taskId` | Reopen completed task |
| `task.delete` | `taskId` | Delete task |
| `task.priority` | `taskId, priority: 0-4` | Change task priority |
| `news.source.add` | `url, title?, tabs?[]` | Add RSS source (with optional tab assignment) |
| `news.source.remove` | `sourceId` | Remove RSS source |
| `news.tab.create` | `name` | Create news tab |
| `delivery.track` | `trackingNumber, title?` | Track a package (auto-detect carrier via TrackingMore) |
| `delivery.remove` | `deliveryId` | Remove delivery tracking |

### Navigation whitelist

**File:** `src/lib/ai/actions-executor.ts` (`ALLOWED_PATHS` set)

```typescript
const ALLOWED_PATHS = new Set([
  '/today',
  '/news',
  '/tasks',
  '/deliveries',
  '/settings',
  '/settings/telegram',
  '/settings/password',
])
```

### Adding a new action

1. Add handler in `executeActions()` in `src/lib/ai/actions-executor.ts`
2. Add to system prompt action list in `src/app/api/ai/chat/route.ts` (in the `system` array)
3. Add SSE event emission in `src/lib/ai/stream-processor.ts` (e.g., filter results by `action?.startsWith('<section>.')`)
4. Add fast-path regex in `src/lib/commands/chat-handlers.ts` (optional, for <1ms responses)

## Client-side event handling

**File:** `src/lib/ai/stream-processor.ts`

Actions executed on the server send SSE events back to the client via the stream processor.

### SSE event types (complete list)

| Event type | Trigger | Payload |
|------------|---------|---------|
| `conversationId` | New chat session | `{ type: 'conversationId', id: string }` |
| `navigation` | `navigate` action | `{ type: 'navigation', target: string }` |
| `task.refresh` | Any `task.*` action | `{ type: 'task.refresh', actions: ActionResult[] }` |
| `news.refresh` | Any `news.*` action | `{ type: 'news.refresh', actions: ActionResult[] }` |
| `delivery.refresh` | Any `delivery.*` action | `{ type: 'delivery.refresh', actions: ActionResult[] }` |
| `error` | Stream processing error | `{ type: 'error', message: string }` |
| `[DONE]` | Stream complete | `data: [DONE]` |

### Client-side listener

```typescript
// Server sends via SSE:
{ type: 'task.refresh', actions: [{ action: 'task.create', taskId: '...', task: {...} }] }

// Client dispatches CustomEvent, component listens:
useEffect(() => {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail
    // detail.actions contains the action results array
  }
  window.addEventListener('clawdos:<section>-refresh', handler)
  return () => window.removeEventListener('clawdos:<section>-refresh', handler)
}, [])
```

### Adding event support for a new section

1. In `src/lib/ai/stream-processor.ts`, add a results filter block after the existing ones:
```typescript
const sectionActions = result.results.filter((r) =>
  r.action?.startsWith('<section>.')
)
if (sectionActions.length > 0) {
  controller.enqueue(
    encoder.encode(`data: ${JSON.stringify({ type: '<section>.refresh', actions: sectionActions })}\n\n`)
  )
}
```

2. In client component, listen for the event (see pattern above)

## System prompt structure

**File:** `src/app/api/ai/chat/route.ts` (the `system` array in POST handler)

The system prompt sent to Clawdbot includes:

```
You are Clawdbot running inside ClawdOS WebUI.
Reply like Telegram/TUI: direct, helpful, no boilerplate.
ClawdOS page: <current page>
ClawdOS workspace: <workspace name>
Telegram DM target: <telegram_user_id> (if linked)

Available actions (11):
1. Navigate: {"k":"navigate","to":"/tasks"}
2. Create task: {"k":"task.create","title":"...","description":"...","priority":2}
3. Complete task: {"k":"task.complete","taskId":"..."}
4. Reopen task: {"k":"task.reopen","taskId":"..."}
5. Delete task: {"k":"task.delete","taskId":"..."}
6. Set priority: {"k":"task.priority","taskId":"...","priority":3}
7. Add RSS: {"k":"news.source.add","url":"...","title":"...","tabs":["Tech"]}
8. Remove RSS: {"k":"news.source.remove","sourceId":"..."}
9. Create tab: {"k":"news.tab.create","name":"..."}
10. Track package: {"k":"delivery.track","trackingNumber":"...","title":"..."}
11. Remove tracking: {"k":"delivery.remove","deliveryId":"..."}

RSS catalog: [list of available feeds for quick setup]
```

When adding a new section with actions, add to this prompt.

## Circuit breaker

**File:** `src/lib/circuit-breaker.ts`

The Clawdbot gateway call is wrapped in `withCircuitBreaker()` to prevent cascading failures when the upstream is down. States: CLOSED (normal) -> OPEN (fail fast after N failures) -> HALF_OPEN (probe). Used in the chat route for the Clawdbot proxy call.

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

## Skill Ecosystem

### What is a skill?

A skill is a directory with a `SKILL.md` file containing YAML frontmatter (name, description) and markdown instructions. Clawdbot loads these at runtime and can activate them contextually.

### Where skills live

| Location | Type | Example |
|----------|------|---------|
| `/root/clawd/skills/` | Workspace (user-installed) | `frontend-design`, `postgres` |
| `/usr/lib/node_modules/clawdbot/skills/` | Built-in (bundled with Clawdbot) | `github`, `slack`, `weather` |

### ClawdHub CLI (`clawdhub`)

Package manager for Clawdbot skills. Installed globally at `/usr/bin/clawdhub`.

```bash
clawdhub list                    # Show installed workspace skills (from lockfile)
clawdhub search "postgres"       # Vector search the registry
clawdhub install <slug>          # Install into ./skills/<slug>/
clawdhub install <slug> --version 1.2.3
clawdhub update <slug>           # Update to latest version
clawdhub update --all            # Update all installed skills
clawdhub explore                 # Browse latest skills from registry
```

**Key details:**
- Default registry: `https://clawdhub.com` (override with `CLAWDHUB_REGISTRY`)
- Working directory: cwd or `CLAWDHUB_WORKDIR` (default: `/root/clawd`)
- Install dir: `./skills/` relative to workdir
- Lockfile: `clawdhub-lock.json` in workdir

### ClawdTM Marketplace API

ClawdTM (`clawdtm.com`) is a web frontend over ClawdHub with security scanning, ratings, and search.

**Search endpoint:** `GET https://clawdtm.com/api/v1/skills/search?q=<query>&limit=<n>`

Response fields per skill: `slug`, `name`, `author`, `description`, `version`, `downloads`, `stars`, `installs`, `security` (score 0-100, risk level, flags), `community` (ratings, verified/featured), `install_command`, `clawdtm_url`.

### Settings UI integration

The `/settings/skills` page has 3 tabs:

| Tab | Source | Files |
|-----|--------|-------|
| **Installed** | Reads `SKILL.md` from disk (workspace + bundled dirs) | `skills-actions.ts`, `InstalledSkillCard.tsx` |
| **Commands** | Hardcoded registry of chat commands | `skills-registry.ts`, `SkillCard.tsx` |
| **Marketplace** | ClawdTM API search | `marketplace-actions.ts`, `MarketplaceCard.tsx` |

Install flow: Marketplace "Install" button → server action calls `clawdhub install <slug>` → refreshes installed list.

## Anti-patterns (DO NOT)

- **DO NOT** call Clawdbot from client-side code — always proxy through Next.js API
- **DO NOT** expose `CLAWDBOT_TOKEN` or `CLAWDBOT_URL` to the browser
- **DO NOT** add Telegram bot/webhook handling in ClawdOS — that's Clawdbot's domain
- **DO NOT** install `@anthropic-ai/sdk` or any LLM SDK — Clawdbot is the only runtime
- **DO NOT** add actions without adding them to the whitelist
- **DO NOT** execute arbitrary model-provided DOM selectors — only whitelisted action keys
- **DO NOT** modify Clawdbot's internal configuration from ClawdOS code
