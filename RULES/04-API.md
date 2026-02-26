# 04 — API Routes

## Route structure

```
src/app/api/
  # --- AI & Chat ---
  ai/chat/route.ts            # Clawdbot proxy (GET history, POST chat, DELETE archive)
  ai/utils/gateway.ts         # Shared gateway helpers
  assistant/route.ts           # Simple Clawdbot passthrough (POST)
  consult/route.ts             # Meta-query endpoint (POST, session OR token auth)

  # --- CRUD APIs ---
  actions/task/route.ts        # Task CRUD (POST create, PATCH complete/reopen, DELETE)
  settings/route.ts            # User settings (GET list, PUT upsert, DELETE key)

  # --- Data ---
  currencies/route.ts          # Currency rates (GET)
  weather/route.ts             # Weather data (GET)
  news/refresh/route.ts        # RSS refresh (POST, session OR token auth)

  # --- System ---
  health/route.ts              # Health check — DB + Clawdbot + pool metrics (GET, no auth)
  version/route.ts             # App version info (GET, no auth)
  build-id/route.ts            # Current build hash (GET, no auth)
  system/status/route.ts       # System info — git, disk, memory (GET)
  system/update/route.ts       # Git pull + rebuild trigger (POST)

  # --- Auth & Workspaces ---
  workspaces/route.ts          # List workspaces (GET)
  workspaces/switch/route.ts   # Switch workspace (POST)

  # --- Webhooks (no session auth, no CSRF) ---
  webhooks/trackingmore/route.ts  # TrackingMore delivery status updates (POST)
```

## Standard pattern for API routes

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth/session'
import { getActiveWorkspace } from '@/lib/workspace'
import { withUser } from '@/lib/db'

export const dynamic = 'force-dynamic'

// 1. Define Zod schemas
const CreateSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
})

// 2. Handler
export async function POST(req: NextRequest) {
  // 3. Auth check
  const session = await getSession()
  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 4. Workspace check
  const workspace = await getActiveWorkspace()
  if (!workspace) {
    return NextResponse.json({ error: 'No active workspace' }, { status: 400 })
  }

  // 5. Validate request body
  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  // 6. Execute under RLS
  try {
    const result = await withUser(session.userId, async (client) => {
      return createItem(client, { ...parsed.data, workspaceId: workspace.id })
    })
    return NextResponse.json({ item: result })
  } catch {
    return NextResponse.json({ error: 'Failed to create item' }, { status: 500 })
  }
}
```

**Etalon:** `src/app/api/actions/task/route.ts` (82 lines — clean, minimal)

## Centralized validation schemas

All Zod schemas are centralized in **`src/lib/validation-schemas.ts`**. Do NOT define ad-hoc schemas in route files — import from validation-schemas.

**Current schemas by domain:**

| Domain | Schemas |
|--------|---------|
| Tasks | `createTaskSchema`, `updateTaskSchema`, `taskIdSchema`, `updateTaskDateSchema`, `updateTaskPrioritySchema`, `recurrenceRuleSchema` |
| Processes | `createProcessSchema`, `updateProcessSchema` |
| Projects | `projectNameSchema` |
| News | `addSourceSchema`, `sourceIdSchema`, `tabIdSchema`, `createTabSchema`, `reorderTabsSchema`, `setupNewsTopicsSchema` |
| Chat | `chatMessageSchema`, `chatDeleteSchema` |
| Assistant | `assistantMessageSchema` |
| Consult | `consultQuestionSchema` |
| Settings | `settingsPutSchema`, `settingsDeleteKeySchema` |
| Workspaces | `workspaceSwitchSchema`, `workspaceIdSchema` |
| Auth | `signInSchema` |
| Skills | `skillSlugSchema`, `marketplaceSearchSchema` |
| Files | `agentFilePathSchema`, `agentFileContentSchema` |
| Dashboard | `dashboardCurrenciesSchema`, `dashboardWeatherCitySchema`, `dashboardTimezoneSchema` |
| Deliveries | `createDeliverySchema`, `deliveryIdSchema` |
| Shared | `uuidSchema`, `currencyQuerySchema`, `weatherQuerySchema` |

### Zod validation rules

- [ ] Always validate with `.safeParse()` — never `.parse()` (which throws)
- [ ] Return 400 with `parsed.error.flatten()` for validation errors
- [ ] Import schemas from `src/lib/validation-schemas.ts` — never define inline
- [ ] Use `.uuid()` for ID fields, `.min(1)` for required strings
- [ ] Use `formatZodErrors()` from `src/lib/validation.ts` for consistent error format

## Session auth

```typescript
const session = await getSession()
if (!session.userId) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

`getSession()` is cached via `React.cache()` — safe to call multiple times per request.

**Session data shape:**
```typescript
interface SessionData {
  userId?: string
  username?: string
  pendingUserId?: string
  pendingChallengeId?: string
}
```

## Dual auth (session OR token)

Some endpoints support both session and token auth (for cron/external callers):

```typescript
const session = await getSession()
const token = req.headers.get('x-clawdos-consult-token')

if (!session.userId && token !== process.env.CLAWDOS_CONSULT_TOKEN) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

**Used by:** `/api/consult`, `/api/news/refresh`

## Error handling

### Standard error responses

```typescript
// 401 — not authenticated
NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

// 400 — bad request (validation / missing workspace)
NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
NextResponse.json({ error: 'No active workspace' }, { status: 400 })

// 404 — not found
NextResponse.json({ error: 'Item not found' }, { status: 404 })

// 500 — server error
NextResponse.json({ error: 'Internal server error' }, { status: 500 })
```

### Rules

- [ ] Never expose stack traces in responses
- [ ] Always return JSON — never plain text errors
- [ ] Log errors server-side with `createLogger()` (never raw `console.*`)
- [ ] Wrap DB operations in try/catch

## Server actions vs API routes

| Use server actions when... | Use API routes when... |
|---|---|
| Called from form submissions | Called from external clients or cron |
| Need `revalidatePath()` | Need to return specific HTTP status codes |
| Only called from same app | Need CORS or custom headers |
| Simple create/update/delete | Complex streaming (SSE) |

### Server action pattern (with validateAction)

```typescript
'use server'

import { getSession } from '@/lib/auth/session'
import { getActiveWorkspace } from '@/lib/workspace'
import { withUser } from '@/lib/db'
import { validateAction } from '@/lib/validation'
import { createItemSchema } from '@/lib/validation-schemas'
import { revalidatePath } from 'next/cache'

export async function createItem(data: unknown) {
  const session = await getSession()
  if (!session.userId) return { error: 'Unauthorized' }

  const parsed = validateAction(createItemSchema, data)
  if (parsed.error) return { error: parsed.error }

  const workspace = await getActiveWorkspace()
  if (!workspace) return { error: 'No active workspace' }

  try {
    const item = await withUser(session.userId, async (client) => {
      return createItemRepo(client, { ...parsed.data, workspaceId: workspace.id })
    })
    revalidatePath('/<section>')
    return { item }
  } catch {
    return { error: 'Failed to create item' }
  }
}
```

**Etalon:** `src/app/(app)/tasks/actions.ts`

## Webhook route pattern

Webhook routes receive callbacks from external services. They differ from normal routes:

- **No session auth** — external services cannot authenticate as a user
- **No CSRF** — exempt in `src/middleware.ts` via `pathname.startsWith('/api/webhooks/')`
- **No `withUser()`** — webhooks do cross-user lookups (e.g., find delivery by tracking number across all users)
- **Direct pool queries** — use `getPool().query()` for system-level DB access

**Pattern (from `webhooks/trackingmore/route.ts`):**
```typescript
import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  // Validate webhook payload structure
  // ...

  // System-level DB access (no withUser — cross-user lookup)
  const pool = getPool()
  const result = await pool.query(
    'SELECT id, workspace_id FROM content.delivery WHERE tracking_number = $1',
    [trackingNumber]
  )

  // Process and update
  // ...

  return NextResponse.json({ success: true })
}
```

**Middleware exemptions** (in `src/middleware.ts`):
- CSRF exempt: `pathname.startsWith('/api/webhooks/')`
- Auth exempt: `pathname.startsWith('/api/webhooks/')` (in `isPublicPath()`)

## Anti-patterns (DO NOT)

- **DO NOT** use `req.body` directly — always parse with `await req.json()` then validate
- **DO NOT** use `.parse()` (throws) — use `.safeParse()` (returns result object)
- **DO NOT** skip session check — every handler must verify auth
- **DO NOT** skip workspace check for workspace-scoped operations
- **DO NOT** call `getPool().query()` directly — always `withUser()` for user data
- **DO NOT** return 200 for errors — use proper HTTP status codes
- **DO NOT** create GET handlers for mutations — use POST/PATCH/DELETE
