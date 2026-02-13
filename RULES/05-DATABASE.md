# 05 — Database Rules

## Stack

- PostgreSQL 16.11
- Client: `pg` (raw SQL, no ORM)
- Connection pool: `src/lib/db/index.ts` (max 20 connections, 30s idle timeout)
- RLS enforcement: `withUser()` wrapper
- Schemas: `core`, `content`, `finance`, `ai`, `analytics`, `biz`, `docs`

## Connection & RLS

### withUser() — the critical wrapper

**File:** `src/lib/db/index.ts`

Every DB operation that touches user data MUST go through `withUser()`:

```typescript
import { withUser } from '@/lib/db'

const result = await withUser(session.userId, async (client) => {
  // client has RLS context set — all queries are filtered by user
  return await getTasksByWorkspace(client, workspace.id)
})
```

**What it does:**
1. Gets a `PoolClient` from the pool
2. `BEGIN` transaction
3. Sets RLS context: `set_config('app.user_id', userId, true)`
4. Executes your function with the client
5. `COMMIT` (or `ROLLBACK` on error)
6. Releases client back to pool

### RLS helper functions

Defined in `db/migrations/001_init.sql`:

```sql
-- Returns current user UUID from session config
core.current_user_id() → uuid

-- Checks if current user is a member of given workspace
core.is_workspace_member(workspace_id uuid) → boolean
```

## Two migration systems

### Main migrations: `db/migrations/`

**Numbering:** `001_init.sql`, `002_data_contracts.sql`, ..., `007_news_perf_indexes.sql`

**Purpose:** Feature-level migrations (tables, indexes, RLS policies)

**Current files:**

| File | Content |
|------|---------|
| `001_init.sql` | Core schema: user, workspace, membership, RLS functions, news_item, digest |
| `002_data_contracts.sql` | Event log, entity/links, settings, files schema |
| `003_ai_schema.sql` | conversation, message tables |
| `004_tasks_schema.sql` | task table with full feature set |
| `005_news_sources.sql` | news_source, news_tab, news_source_tab junction |
| `006_news_image.sql` | image_url column on news_item |
| `007_news_perf_indexes.sql` | Performance indexes for news |

**When to use:** For new features, new tables, new columns.

### Namespace migrations: `db/schema/core/migrations/`

**Numbering:** `0001_core_namespaces.sql`, ..., `0005_auth_challenge_link.sql`

**Purpose:** Schema-level structural changes (namespace moves, RLS fixes, auth columns)

| File | Content |
|------|---------|
| `0001_core_namespaces.sql` | Create schema namespaces, helpers |
| `0002_move_public_to_namespaces.sql` | Move tables from public to schemas |
| `0003_fix_membership_rls.sql` | Fix recursive RLS on membership |
| `0004_auth_telegram.sql` | telegram_user_id, auth_challenge, telegram_outbox |
| `0005_auth_challenge_link.sql` | Auth challenge link support |

**When to use:** For structural/schema-level changes. Rare.

### Running migrations

```bash
node scripts/migrate.mjs
```

## Writing a new migration

### Template

```sql
-- Migration NNN: <section> schema
-- Phase: <number> (<name>)

begin;

-- ===================== TABLES =====================

create table if not exists <schema>.<table> (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references core.workspace(id) on delete cascade,
  title         text not null,
  -- ... columns ...
  created_by    uuid references core."user"(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ===================== TRIGGERS =====================

create trigger set_updated_at
  before update on <schema>.<table>
  for each row execute function core.trigger_set_updated_at();

-- ===================== INDEXES =====================

create index if not exists <table>_workspace_idx
  on <schema>.<table> (workspace_id);

-- ===================== RLS =====================

alter table <schema>.<table> enable row level security;

-- SELECT: workspace members can read
create policy "<table>_select"
  on <schema>.<table> for select
  using (core.is_workspace_member(workspace_id));

-- INSERT: workspace members can create, must set created_by
create policy "<table>_insert"
  on <schema>.<table> for insert
  with check (
    core.is_workspace_member(workspace_id)
    and created_by = core.current_user_id()
  );

-- UPDATE: workspace members can update
create policy "<table>_update"
  on <schema>.<table> for update
  using (core.is_workspace_member(workspace_id));

-- DELETE: workspace members can delete
create policy "<table>_delete"
  on <schema>.<table> for delete
  using (core.is_workspace_member(workspace_id));

commit;
```

### PostgreSQL 16.11 limitation

`CREATE POLICY IF NOT EXISTS` is **NOT supported**. The migration runner preprocesses SQL to handle this.

**Idempotent policy pattern:**

```sql
-- Drop + recreate (safe for idempotent re-runs)
drop policy if exists "<table>_select" on <schema>.<table>;
create policy "<table>_select"
  on <schema>.<table> for select
  using (core.is_workspace_member(workspace_id));
```

Or wrap the whole migration in a `BEGIN; ... COMMIT;` block (the migration runner tracks applied migrations).

## Repository pattern

### File location

```
src/lib/db/repositories/<section>.repository.ts
```

### Standard structure

```typescript
import type { PoolClient } from 'pg'

// 1. Entity type
export interface Item {
  id: string
  workspaceId: string
  title: string
  // ... fields matching DB columns (camelCase)
  createdAt: Date
  updatedAt: Date
}

// 2. Create params
export interface CreateItemParams {
  workspaceId: string
  title: string
  // ... required and optional fields
}

// 3. CRUD functions — all accept PoolClient as first arg

export async function createItem(client: PoolClient, params: CreateItemParams): Promise<Item> {
  const result = await client.query(
    `INSERT INTO <schema>.<table> (workspace_id, title, created_by)
     VALUES ($1, $2, core.current_user_id())
     RETURNING id, workspace_id AS "workspaceId", title, created_at AS "createdAt", updated_at AS "updatedAt"`,
    [params.workspaceId, params.title]
  )
  return result.rows[0] as Item
}

export async function findItemsByWorkspace(
  client: PoolClient,
  workspaceId: string
): Promise<Item[]> {
  const result = await client.query(
    `SELECT id, workspace_id AS "workspaceId", title, created_at AS "createdAt", updated_at AS "updatedAt"
     FROM <schema>.<table>
     WHERE workspace_id = $1
     ORDER BY created_at DESC`,
    [workspaceId]
  )
  return result.rows as Item[]
}
```

### SQL conventions

- Use `$1`, `$2` parameterised queries — **never** string interpolation
- Use `AS "camelCase"` aliases in SELECT to match TypeScript interfaces
- Use `core.current_user_id()` for `created_by` fields
- Use `ON CONFLICT ... DO NOTHING` or `DO UPDATE` for upserts
- Use `RETURNING` clause instead of separate SELECT after INSERT

### Etalon repositories

| Repository | Complexity | Good example of |
|-----------|-----------|----------------|
| `task.repository.ts` | Medium (354 lines) | Full CRUD, dynamic UPDATE, status logic, array operations |
| `news-source.repository.ts` | Medium (158 lines) | Status tracking, error counting, stale detection |
| `news-tab.repository.ts` | Medium (147 lines) | Junction table management, bulk reorder |
| `news.repository.ts` | Complex (206 lines) | Dynamic WHERE builder, cursor pagination, ILIKE search, batch upsert |
| `workspace.repository.ts` | Simple (14 lines) | Minimal query with JOIN |

## Anti-patterns (DO NOT)

- **DO NOT** use `getPool().query()` for user data — always `withUser()`
- **DO NOT** use string interpolation in SQL — always parameterised queries
- **DO NOT** create tables without RLS policies
- **DO NOT** use `CREATE POLICY IF NOT EXISTS` — not supported in PostgreSQL 16.11
- **DO NOT** install Prisma, Drizzle, TypeORM, or any ORM
- **DO NOT** create tables in the `public` schema — use `core`, `content`, etc.
- **DO NOT** skip the `created_by` column — it's part of the RLS contract
- **DO NOT** use `SERIAL` for IDs — use `uuid primary key default gen_random_uuid()`
