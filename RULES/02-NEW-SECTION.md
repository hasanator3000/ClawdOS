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
- [ ] Handle edge cases: no session (return null), no workspace (message)
- [ ] Render client component with `initialData` prop

**Etalon:** `src/app/(app)/tasks/page.tsx`

### Step 6 — Create client components

- [ ] Create components in `src/app/(app)/<section>/` (co-located with page)
- [ ] Add `'use client'` directive at top
- [ ] Accept `initial*` props from server component
- [ ] Use `useState` for local state, `useTransition` for server action calls
- [ ] Follow visual patterns from [01-STYLE-GUIDE.md](01-STYLE-GUIDE.md)
- [ ] Handle loading, empty, and error states

**Etalon:** `src/app/(app)/tasks/TaskList.tsx`

### Step 7 — Add sidebar navigation

- [ ] Edit `src/components/layout/SidebarClient.tsx`
- [ ] Add entry to the navigation links array with icon and path

## Phase 4: Integration

> Reference section: [06-CLAWDBOT-INTEGRATION.md](06-CLAWDBOT-INTEGRATION.md)

### Step 8 — Add AI actions (if the section should be controllable via chat)

- [ ] Add action handlers in `src/app/api/ai/chat/route.ts`:
  - Add to `executeActions()` switch
  - Add to system prompt action list
- [ ] Add to navigation whitelist if it's a navigable page
- [ ] Add fast-path regex patterns in `src/lib/commands/chat-handlers.ts` (optional, for <1ms responses)

### Step 9 — Update event protocol (if needed)

- [ ] Add custom event type if the section needs live updates from AI (like `lifeos:task-refresh`)
- [ ] Listen for events in the client component

## Phase 5: Deployment contract

> Reference section: [08-DEPLOY-CONTRACT.md](08-DEPLOY-CONTRACT.md)

### Step 10 — Update manifests

- [ ] If new ENV variables: add to `.env.example` and `.env.local.example` (NO real values)
- [ ] If new DB tables: migration already handles this (from Step 1)
- [ ] Update `dev/capabilities.json` with new routes and tables
- [ ] Update `dev/AGENT_MANIFEST.md` if adding new integration points

## Summary: minimum file set for a DB-backed section

```
db/migrations/NNN_<section>_schema.sql          # Schema + RLS
src/lib/db/repositories/<section>.repository.ts  # CRUD functions
src/app/api/actions/<section>/route.ts           # HTTP API (optional)
src/app/(app)/<section>/actions.ts               # Server actions
src/app/(app)/<section>/page.tsx                 # Server page
src/app/(app)/<section>/<Component>.tsx           # Client UI
```

## Summary: frontend-only section (no DB)

```
src/app/(app)/<section>/page.tsx                 # Server page
src/app/(app)/<section>/<Component>.tsx           # Client UI
```
