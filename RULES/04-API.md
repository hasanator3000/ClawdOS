# 04 — API Routes

## Route structure

```
src/app/api/
  ai/chat/route.ts          # Clawdbot proxy (GET history, POST chat, DELETE archive)
  actions/task/route.ts      # Task CRUD (POST create, PATCH complete/reopen, DELETE)
  assistant/route.ts         # Simple Clawdbot passthrough
  consult/route.ts           # Meta-query endpoint
  currencies/route.ts        # Currency rates (GET)
  news/refresh/route.ts      # RSS refresh (POST)
  workspaces/route.ts        # List workspaces (GET)
  workspaces/switch/route.ts # Switch workspace (POST)
  auth/logout/route.ts       # Logout (POST)
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

## Zod validation

### Current patterns in use

```typescript
// Task creation
const CreateTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  priority: z.number().int().min(0).max(4).optional(),
  dueDate: z.string().optional(),
  dueTime: z.string().optional(),
  tags: z.array(z.string().max(64)).optional(),
})

// Task mutation
const MutateTaskSchema = z.object({
  op: z.enum(['complete', 'reopen']),
  taskId: z.string().uuid(),
})

// Task deletion
const DeleteTaskSchema = z.object({
  taskId: z.string().uuid(),
})
```

### Rules

- [ ] Always validate with `.safeParse()` — never `.parse()` (which throws)
- [ ] Return 400 with `parsed.error.flatten()` for validation errors
- [ ] Keep schemas at file top, before handlers
- [ ] Use `.uuid()` for ID fields, `.min(1)` for required strings

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
- [ ] Log errors server-side with `console.error()` (not `console.log`)
- [ ] Wrap DB operations in try/catch

## Server actions vs API routes

| Use server actions when... | Use API routes when... |
|---|---|
| Called from form submissions | Called from external clients or cron |
| Need `revalidatePath()` | Need to return specific HTTP status codes |
| Only called from same app | Need CORS or custom headers |
| Simple create/update/delete | Complex streaming (SSE) |

### Server action pattern

```typescript
'use server'

import { getSession } from '@/lib/auth/session'
import { getActiveWorkspace } from '@/lib/workspace'
import { withUser } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function createItem(params: { title: string }) {
  const session = await getSession()
  if (!session.userId) return { error: 'Unauthorized' }

  const workspace = await getActiveWorkspace()
  if (!workspace) return { error: 'No active workspace' }

  try {
    const item = await withUser(session.userId, async (client) => {
      return createItemRepo(client, { ...params, workspaceId: workspace.id })
    })
    revalidatePath('/<section>')
    return { item }
  } catch {
    return { error: 'Failed to create item' }
  }
}
```

**Etalon:** `src/app/(app)/tasks/actions.ts`

## Anti-patterns (DO NOT)

- **DO NOT** use `req.body` directly — always parse with `await req.json()` then validate
- **DO NOT** use `.parse()` (throws) — use `.safeParse()` (returns result object)
- **DO NOT** skip session check — every handler must verify auth
- **DO NOT** skip workspace check for workspace-scoped operations
- **DO NOT** call `getPool().query()` directly — always `withUser()` for user data
- **DO NOT** return 200 for errors — use proper HTTP status codes
- **DO NOT** create GET handlers for mutations — use POST/PATCH/DELETE
