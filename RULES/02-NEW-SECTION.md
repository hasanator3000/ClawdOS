# 02 — Adding a New Section (Scaffold Checklist)

Step-by-step guide with dependency order. Each step depends on the previous one.

## Prerequisites

- [ ] Read [07-GOLDEN-RULES.md](07-GOLDEN-RULES.md) — know what NOT to do
- [ ] Read [01-STYLE-GUIDE.md](01-STYLE-GUIDE.md) — know the visual contract
- [ ] Decide: does the section need its own DB tables? Its own API? Or is it frontend-only?

## Phase 1: Database (if needed)

> Reference section: [05-DATABASE.md](05-DATABASE.md)

### Step 1 — Create migration + update YAML registry

Follow the complete cookbook in [05-DATABASE.md § Cookbook](05-DATABASE.md#cookbook-adding-a-db-table-for-a-new-section):

- [ ] Pick the correct schema namespace (see namespace table in 05-DATABASE.md)
- [ ] Create file `db/migrations/NNN_<section>_schema.sql` (next number in sequence)
- [ ] Copy the [Migration Template](05-DATABASE.md#migration-template) — includes table, trigger, indexes, RLS
- [ ] Use the correct schema namespace (`core.*` for core entities, `content.*` for content, etc.)
- [ ] Enable RLS + create all 4 policies (SELECT, INSERT, UPDATE, DELETE)
- [ ] Add `updated_at` trigger using `core.trigger_set_updated_at()`
- [ ] **Update `db/schema_registry.yaml`** — add table name to schema's list, bump version
- [ ] **Update `db/schema/<namespace>/schema.yaml`** — add full table definition with all columns, indexes, RLS (see [YAML column type patterns](05-DATABASE.md#yaml-column-type-patterns))
- [ ] Test migration: `npm run db:migrate`

**Etalon migration:** `db/migrations/004_tasks_schema.sql`
**Etalon YAML:** `db/schema/content/schema.yaml` (news_source entry)

### Step 2 — Create repository

- [ ] Create `src/lib/db/repositories/<section>.repository.ts`
- [ ] Import `PoolClient` from `pg`
- [ ] Define TypeScript interface for the entity
- [ ] Define `Create*Params` and `Update*Params` interfaces
- [ ] Implement CRUD functions: `create*`, `find*ByWorkspace`, `find*ById`, `update*`, `delete*`
- [ ] All functions accept `client: PoolClient` as first arg
- [ ] Use parameterised queries (`$1`, `$2`, ...) — never string interpolation
- [ ] Use `core.current_user_id()` for `created_by` in INSERTs

**Etalon:** `src/lib/db/repositories/task.repository.ts`

## Phase 2: API layer

> Reference section: [04-API.md](04-API.md)

### Step 3 — Create API route (if needed for external/AJAX calls)

- [ ] Create `src/app/api/actions/<section>/route.ts`
- [ ] Add `export const dynamic = 'force-dynamic'`
- [ ] Define Zod schemas for request validation
- [ ] Implement handlers (POST, PATCH, DELETE as needed):
  1. `getSession()` -> 401 if no `session.userId`
  2. `getActiveWorkspace()` -> 400 if no workspace
  3. Zod `.safeParse(body)` -> 400 if invalid
  4. `withUser(session.userId, async (client) => { ... })` -> call repository
  5. Return `NextResponse.json({ data })` or `NextResponse.json({ error }, { status })`

**Etalon:** `src/app/api/actions/task/route.ts`

### Step 4 — Create server actions (for form submissions)

- [ ] Create `src/app/(app)/<section>/actions.ts`
- [ ] Add `'use server'` at top
- [ ] Each action: `getSession()` -> `getActiveWorkspace()` -> `withUser()` -> `revalidatePath('/<section>')`
- [ ] Return `{ data }` or `{ error: string }` — never throw

**Etalon:** `src/app/(app)/tasks/actions.ts`

## Phase 3: Frontend

> Reference section: [03-FRONTEND.md](03-FRONTEND.md)

### Step 5 — Create the page

- [ ] Create `src/app/(app)/<section>/page.tsx`
- [ ] Make it a **server component** (async function, no `'use client'`)
- [ ] Add `export const dynamic = 'force-dynamic'`
- [ ] Fetch data: `getSession()` + `getActiveWorkspace()` + `withUser()` + repository call
- [ ] Handle edge cases: no session (`redirect('/login')`), no workspace (message)
- [ ] Render client component with `initialData` prop

**Pattern (from `deliveries/page.tsx`):**
```tsx
import { getSession } from '@/lib/auth/session'
import { getActiveWorkspace } from '@/lib/workspace'
import { withUser } from '@/lib/db'
import { findItemsByWorkspace } from '@/lib/db/repositories/<section>.repository'
import { redirect } from 'next/navigation'
import { SectionList } from './SectionList'

export const dynamic = 'force-dynamic'

export default async function SectionPage() {
  const [session, workspace] = await Promise.all([
    getSession(),
    getActiveWorkspace(),
  ])

  if (!session.userId) redirect('/login')

  if (!workspace) {
    return (
      <div className="p-6">
        <div className="text-center text-[var(--muted)]">Select a workspace to view items</div>
      </div>
    )
  }

  const items = await withUser(session.userId, async (client) => {
    return findItemsByWorkspace(client, workspace.id)
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Section Title</h1>
      </div>
      <SectionList initialItems={items} />
    </div>
  )
}
```

**Etalon:** `src/app/(app)/deliveries/page.tsx`

### Step 6 — Create loading.tsx + error.tsx (MANDATORY)

Every route segment MUST have both files for proper loading states and error boundaries.

- [ ] Create `src/app/(app)/<section>/loading.tsx` — skeleton UI
- [ ] Create `src/app/(app)/<section>/error.tsx` — error boundary with retry

**Etalon:** Any existing route segment (e.g. `src/app/(app)/tasks/loading.tsx`, `src/app/(app)/error.tsx`)

### Step 7 — Create client components

- [ ] Create components in `src/app/(app)/<section>/` (co-located with page)
- [ ] Add `'use client'` directive at top
- [ ] Accept `initial*` props from server component
- [ ] Use `useState` for local state, `useTransition` for server action calls
- [ ] Follow visual patterns from [01-STYLE-GUIDE.md](01-STYLE-GUIDE.md)
- [ ] Handle loading, empty, and error states

**Etalon:** `src/app/(app)/tasks/TaskList.tsx`

### Step 8 — Add navigation

Navigation has 3 touchpoints — update ALL of them:

- [ ] Edit `src/lib/nav/sections.ts` — add a `Section` entry with `id`, `title`, `path`, `aliases`, and `sidebar: true`
- [ ] Edit `src/components/layout/sidebar/nav-icons.tsx` — add SVG icon for the section
- [ ] Edit `src/components/shell/BottomTabBar.tsx` — add tab entry to `TABS` array + icon to `TAB_ICONS`

**Etalon:** Look at the `deliveries` section entry in each file.

### Step 9 — Register validation schemas

- [ ] Add Zod schemas for the section in `src/lib/validation-schemas.ts`
- [ ] Use these schemas in server actions via `validateAction()` and in API routes via `withValidation()` or `.safeParse()`

**Etalon:** `createDeliverySchema` and `deliveryIdSchema` in `src/lib/validation-schemas.ts`

## Phase 4: Integration

> Reference section: [06-CLAWDBOT-INTEGRATION.md](06-CLAWDBOT-INTEGRATION.md)

### Step 10 — Add AI actions (if the section should be controllable via chat)

Three files to update:

- [ ] `src/lib/ai/actions-executor.ts` — add action handler(s) with new action key(s) (e.g., `<section>.create`, `<section>.delete`)
- [ ] `src/app/api/ai/chat/route.ts` — add to system prompt action list (in `buildSystemPrompt()`)
- [ ] Add to navigation whitelist in `actions-executor.ts` `ALLOWED_PATHS` set if it's a navigable page
- [ ] Add fast-path regex patterns in `src/lib/commands/chat-handlers.ts` (optional, for <1ms responses)

### Step 11 — Update event protocol (if needed)

- [ ] In `src/lib/ai/stream-processor.ts` — add SSE event emission for the section (e.g., `{ type: '<section>.refresh', actions: results }`)
- [ ] In client component — listen for the event:
```tsx
useEffect(() => {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail
    // Update state from detail.actions
  }
  window.addEventListener('clawdos:<section>-refresh', handler)
  return () => window.removeEventListener('clawdos:<section>-refresh', handler)
}, [])
```

## Phase 5: Deployment contract

> Reference section: [08-DEPLOY-CONTRACT.md](08-DEPLOY-CONTRACT.md)

### Step 12 — Update manifests

- [ ] If new ENV variables: add to `.env.example` and `.env.local.example` (NO real values)
- [ ] If new DB tables: migration already handles this (from Step 1)
- [ ] Update `dev/capabilities.json` with new routes and tables
- [ ] Update `dev/AGENT_MANIFEST.md` if adding new integration points

## Summary: minimum file set for a DB-backed section

```
db/migrations/NNN_<section>_schema.sql             # Schema + RLS
db/schema_registry.yaml                            # Updated with new table
db/schema/<namespace>/schema.yaml                   # YAML table definition
src/lib/db/repositories/<section>.repository.ts     # CRUD functions
src/lib/validation-schemas.ts                       # Updated with section schemas
src/app/api/actions/<section>/route.ts              # HTTP API (optional)
src/app/(app)/<section>/actions.ts                  # Server actions
src/app/(app)/<section>/page.tsx                    # Server page
src/app/(app)/<section>/loading.tsx                 # Loading skeleton (MANDATORY)
src/app/(app)/<section>/error.tsx                   # Error boundary (MANDATORY)
src/app/(app)/<section>/<Component>.tsx              # Client UI
src/lib/nav/sections.ts                             # Navigation entry
src/components/layout/sidebar/nav-icons.tsx          # Sidebar icon
src/components/shell/BottomTabBar.tsx                # Mobile tab entry
src/lib/ai/actions-executor.ts                      # AI action handlers (if chat-controllable)
src/lib/ai/stream-processor.ts                      # SSE event emission (if live updates)
```

**Etalon section:** `deliveries` — `db/migrations/012_deliveries_schema.sql` + all files above.

## Summary: frontend-only section (no DB)

```
src/app/(app)/<section>/page.tsx                    # Server page
src/app/(app)/<section>/loading.tsx                 # Loading skeleton (MANDATORY)
src/app/(app)/<section>/error.tsx                   # Error boundary (MANDATORY)
src/app/(app)/<section>/<Component>.tsx              # Client UI
src/lib/nav/sections.ts                             # Navigation entry
src/components/layout/sidebar/nav-icons.tsx          # Sidebar icon
src/components/shell/BottomTabBar.tsx                # Mobile tab entry
```
