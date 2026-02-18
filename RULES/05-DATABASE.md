# 05 — Database Rules

## Stack

- PostgreSQL 16.11
- Client: `pg` (raw SQL, no ORM)
- Connection pool: `src/lib/db/index.ts` (max 20 connections, 30s idle timeout)
- RLS enforcement: `withUser()` wrapper
- Schema namespaces: `core`, `content`, `finance`, `ai`, `analytics`, `biz`, `docs`

---

## Cookbook: Adding a DB Table for a New Section

This is the complete step-by-step guide. Follow it exactly.

### Step 0 — Pick the schema namespace

| Namespace | Use for | Example tables |
|-----------|---------|----------------|
| `core` | Users, workspaces, auth, membership, tasks | `user`, `workspace`, `task` |
| `content` | News, feeds, articles, media | `news_item`, `news_source`, `digest` |
| `ai` | Chat history, embeddings, prompts | `conversation`, `message` |
| `finance` | Accounts, transactions, budgets | *(empty — planned)* |
| `biz` | Clients, projects, invoices | *(empty — planned)* |
| `docs` | Files, OCR, versions | *(empty — planned)* |
| `analytics` | Metrics, aggregates, reports | *(empty — planned)* |

**Rule:** Never use the `public` schema. Pick the namespace that matches the domain.

### Step 1 — Create migration file

Find the next number in `db/migrations/`:

```bash
ls db/migrations/
# 001_init.sql  002_data_contracts.sql ... 007_news_perf_indexes.sql
# Next: 008
```

Create `db/migrations/008_<section>_schema.sql`. Use the full template from the [Migration Template](#migration-template) section below.

### Step 2 — Update schema registry YAML

**2a.** Edit `db/schema_registry.yaml` — add tables to the schema's list:

```yaml
schemas:
  content:   # existing schema
    version: 3   # bump version
    tables: [digest, news_item, news_source, news_tab, news_source_tab, YOUR_NEW_TABLE]
```

If you're using a NEW schema namespace that has no tables yet (e.g. `finance`):

```yaml
schemas:
  finance:
    version: 2    # bump from 1
    status: stable  # change from development
    tables: [account, transaction]
```

**2b.** Edit `db/schema/<namespace>/schema.yaml` — add full table definition:

```yaml
# In db/schema/content/schema.yaml (or whichever namespace)

tables:
  # ... existing tables ...

  your_new_table:
    schema: content
    description: "What this table stores"
    columns:
      id: { type: uuid, primary_key: true, default: gen_random_uuid() }
      workspace_id:
        type: uuid
        nullable: false
        references: core.workspace(id)
        on_delete: CASCADE
      title: { type: text, nullable: false }
      status:
        type: text
        nullable: false
        default: "'draft'"
        check: "status IN ('draft','published','archived')"
      created_by: { type: uuid, nullable: true, references: "core.user(id)", on_delete: SET NULL }
      created_at: { type: timestamptz, nullable: false, default: now() }
      updated_at: { type: timestamptz, nullable: false, default: now() }
    indexes:
      - { name: your_new_table_ws_idx, columns: [workspace_id], unique: false }
    rls:
      enabled: true
      policies:
        - { name: your_new_table_select, for: SELECT, using: "core.is_workspace_member(workspace_id)" }
        - { name: your_new_table_insert, for: INSERT, with_check: "core.is_workspace_member(workspace_id)" }
        - { name: your_new_table_update, for: UPDATE, using: "core.is_workspace_member(workspace_id)" }
        - { name: your_new_table_delete, for: DELETE, using: "core.is_workspace_member(workspace_id)" }
```

### Step 3 — Apply migration

```bash
npm run db:migrate
```

### Step 4 — Create repository

Create `src/lib/db/repositories/<section>.repository.ts`. See [Repository Pattern](#repository-pattern) below.

### Step 5 — Regenerate baseline (optional, recommended)

After adding a migration, regenerate the baseline for fresh installs:

```bash
PGPASSWORD=clawdos_change_me pg_dump --schema-only --no-owner --no-privileges \
  -h 127.0.0.1 -U clawdos -d clawdos -n core -n content > db/schema.sql
```

Then add migration marks at the end of `db/schema.sql` so `migrate.mjs` won't re-run them:

```sql
-- Mark migrations as applied
INSERT INTO core._migrations (id) VALUES
  ('001_init.sql'),
  ('002_data_contracts.sql'),
  -- ... all existing ...
  ('008_your_new_migration.sql')
ON CONFLICT DO NOTHING;

COMMIT;
```

---

## Schema Registry YAML System

The YAML registry is the **source of truth** for what exists in the database. It serves two purposes:

1. **Documentation** — coding agents read it to understand the DB structure
2. **Validation** — ensures new tables follow conventions

### Registry structure

```
db/
  schema_registry.yaml              # Master index: lists all schemas + tables
  schema/
    core/
      schema.yaml                   # Detailed column-level definition for core tables
      migrations/                   # Namespace-level migrations (rare)
    content/
      schema.yaml                   # Detailed definition for content tables
    ai/
      schema.yaml                   # (mostly empty — planned)
    finance/
      schema.yaml                   # (empty — planned)
    biz/
      schema.yaml                   # (empty — planned)
    docs/
      schema.yaml                   # (empty — planned)
    analytics/
      schema.yaml                   # (empty — planned)
```

### `db/schema_registry.yaml` format

```yaml
registry_version: 1
last_updated: 2026-02-10
schemas:
  core:
    version: 1          # Bump when adding/changing tables
    status: stable      # stable | development | experimental
    tables: [app_user, workspace, workspace_member]
    functions: [app_current_user_id]
  content:
    version: 2
    status: stable
    depends_on: [core]
    tables: [digest, news_item, news_source, news_tab, news_source_tab]
  finance:
    version: 1
    status: development   # No tables yet
    depends_on: [core]
    tables: []
```

### Per-schema `schema.yaml` format

Each table entry must have:

| Field | Required | Description |
|-------|----------|-------------|
| `schema` | Yes | Namespace (`core`, `content`, etc.) |
| `description` | Yes | What this table stores |
| `columns` | Yes | Column definitions with type, nullable, default, references, check |
| `indexes` | No | List of indexes (name, columns, unique, where) |
| `constraints` | No | Named constraints (unique, check, exclude) |
| `rls.enabled` | Yes | Must be `true` for user-data tables |
| `rls.policies` | Yes* | List of RLS policies (name, for, using, with_check) |

*Required when `rls.enabled: true`

### YAML column type patterns

```yaml
# UUID primary key (standard for all tables)
id: { type: uuid, primary_key: true, default: gen_random_uuid() }

# Foreign key to workspace (required for RLS)
workspace_id:
  type: uuid
  nullable: false
  references: core.workspace(id)
  on_delete: CASCADE

# Foreign key to user (for created_by)
created_by: { type: uuid, nullable: true, references: "core.user(id)", on_delete: SET NULL }

# Text with enum check
status:
  type: text
  nullable: false
  default: "'active'"
  check: "status IN ('active','paused','error')"

# Integer with default
sort_order: { type: integer, nullable: false, default: 0 }

# Optional date
due_date: { type: date, nullable: true }

# Text array
tags: { type: "text[]", nullable: false, default: "'{}'" }

# Timestamps (always include both)
created_at: { type: timestamptz, nullable: false, default: now() }
updated_at: { type: timestamptz, nullable: false, default: now() }
```

---

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

---

## Migration System

### How migrations are tracked

`scripts/migrate.mjs` tracks applied migrations in `core._migrations` table:

1. Reads all `.sql` files from `db/migrations/` in sorted order
2. Checks `core._migrations` for each file name
3. Skips if already applied
4. Executes the SQL and records the file name
5. Preprocesses `CREATE POLICY IF NOT EXISTS` → `CREATE POLICY` (PG 16 compat)

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

**Purpose:** Schema-level structural changes (namespace moves, RLS fixes, auth columns). **Rare.**

### Running migrations

```bash
npm run db:migrate    # Apply pending migrations (existing DB)
npm run setup         # Full setup (fresh DB uses db/schema.sql baseline)
npm run db:reset      # Destroy + recreate DB from scratch
```

### Baseline schema: `db/schema.sql`

For **fresh installs**, the setup script applies `db/schema.sql` — a single file containing the complete schema. This is faster and more reliable than running all migrations sequentially.

For **upgrades**, `migrate.mjs` applies only new migrations.

---

## Migration Template

Copy this for every new migration. Replace `<schema>`, `<table>`, `<section>`:

```sql
-- Migration NNN: <section> schema
-- Adds <description>

begin;

-- ===================== TABLES =====================

create table if not exists <schema>.<table> (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references core.workspace(id) on delete cascade,

  -- Content columns
  title         text not null,
  description   text,

  -- Status (with enum check)
  status        text not null default 'active'
    check (status in ('active', 'archived', 'deleted')),

  -- Optional FK to user
  assignee_id   uuid references core."user"(id) on delete set null,

  -- Audit
  created_by    uuid references core."user"(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ===================== TRIGGERS =====================

-- Auto-update updated_at (uses existing trigger function from 001_init.sql)
create trigger set_<table>_updated_at
  before update on <schema>.<table>
  for each row execute function core.trigger_set_updated_at();

-- ===================== INDEXES =====================

create index if not exists <table>_workspace_idx
  on <schema>.<table> (workspace_id);

create index if not exists <table>_status_idx
  on <schema>.<table> (workspace_id, status);

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
  using (core.is_workspace_member(workspace_id))
  with check (core.is_workspace_member(workspace_id));

-- DELETE: workspace members can delete
create policy "<table>_delete"
  on <schema>.<table> for delete
  using (core.is_workspace_member(workspace_id));

commit;
```

### PostgreSQL 16.11 limitation

`CREATE POLICY IF NOT EXISTS` is **NOT supported**. The migration runner preprocesses SQL to strip `IF NOT EXISTS` from policy creation, but to be safe:

**Idempotent policy pattern (for re-runnable migrations):**

```sql
drop policy if exists "<table>_select" on <schema>.<table>;
create policy "<table>_select"
  on <schema>.<table> for select
  using (core.is_workspace_member(workspace_id));
```

### Common column patterns

```sql
-- UUID primary key (always)
id uuid primary key default gen_random_uuid()

-- Workspace FK (required for RLS)
workspace_id uuid not null references core.workspace(id) on delete cascade

-- User FK (created_by — nullable, set null on delete)
created_by uuid references core."user"(id) on delete set null

-- Text enum with check constraint
status text not null default 'draft'
  check (status in ('draft', 'published', 'archived'))

-- Optional date
due_date date

-- Optional time
due_time time

-- Text array with empty default
tags text[] not null default '{}'

-- Integer counter
error_count integer not null default 0

-- Optional text
description text

-- Timestamps (always include both)
created_at timestamptz not null default now()
updated_at timestamptz not null default now()

-- Optional completion timestamp
completed_at timestamptz

-- Sort order
sort_order integer not null default 0
```

### Junction table pattern (M:M)

For many-to-many relationships where the table has no `workspace_id`:

```sql
create table if not exists <schema>.<table_a>_<table_b> (
  <a>_id uuid not null references <schema>.<table_a>(id) on delete cascade,
  <b>_id uuid not null references <schema>.<table_b>(id) on delete cascade,
  primary key (<a>_id, <b>_id)
);

-- RLS — derived from parent table's workspace
alter table <schema>.<table_a>_<table_b> enable row level security;

create policy "<table_a>_<table_b>_select"
  on <schema>.<table_a>_<table_b> for select
  using (
    exists (
      select 1 from <schema>.<table_a> a
      where a.id = <a>_id and core.is_workspace_member(a.workspace_id)
    )
  );

-- Same pattern for INSERT and DELETE
```

---

## Repository Pattern

### File location

```
src/lib/db/repositories/<section>.repository.ts
```

### Standard structure

```typescript
import type { PoolClient } from 'pg'

// 1. Entity type — matches DB columns in camelCase
export interface Item {
  id: string
  workspaceId: string
  title: string
  status: string
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
}

// 2. Create params — only writable fields
export interface CreateItemParams {
  workspaceId: string
  title: string
  status?: string
}

// 3. Update params — all optional except id
export interface UpdateItemParams {
  title?: string
  status?: string
}

// 4. CRUD functions — all accept PoolClient as first arg

export async function createItem(client: PoolClient, params: CreateItemParams): Promise<Item> {
  const result = await client.query(
    `INSERT INTO <schema>.<table> (workspace_id, title, status, created_by)
     VALUES ($1, $2, $3, core.current_user_id())
     RETURNING id, workspace_id AS "workspaceId", title, status,
       created_by AS "createdBy", created_at AS "createdAt", updated_at AS "updatedAt"`,
    [params.workspaceId, params.title, params.status ?? 'active']
  )
  return result.rows[0] as Item
}

export async function findItemsByWorkspace(
  client: PoolClient,
  workspaceId: string
): Promise<Item[]> {
  const result = await client.query(
    `SELECT id, workspace_id AS "workspaceId", title, status,
       created_by AS "createdBy", created_at AS "createdAt", updated_at AS "updatedAt"
     FROM <schema>.<table>
     WHERE workspace_id = $1
     ORDER BY created_at DESC`,
    [workspaceId]
  )
  return result.rows as Item[]
}

export async function findItemById(
  client: PoolClient,
  id: string
): Promise<Item | null> {
  const result = await client.query(
    `SELECT id, workspace_id AS "workspaceId", title, status,
       created_by AS "createdBy", created_at AS "createdAt", updated_at AS "updatedAt"
     FROM <schema>.<table>
     WHERE id = $1`,
    [id]
  )
  return (result.rows[0] as Item) ?? null
}

export async function updateItem(
  client: PoolClient,
  id: string,
  params: UpdateItemParams
): Promise<Item> {
  // Dynamic SET — only update provided fields
  const sets: string[] = []
  const vals: unknown[] = []
  let idx = 1

  if (params.title !== undefined) { sets.push(`title = $${idx++}`); vals.push(params.title) }
  if (params.status !== undefined) { sets.push(`status = $${idx++}`); vals.push(params.status) }

  sets.push(`updated_at = now()`)
  vals.push(id)

  const result = await client.query(
    `UPDATE <schema>.<table> SET ${sets.join(', ')} WHERE id = $${idx}
     RETURNING id, workspace_id AS "workspaceId", title, status,
       created_by AS "createdBy", created_at AS "createdAt", updated_at AS "updatedAt"`,
    vals
  )
  return result.rows[0] as Item
}

export async function deleteItem(client: PoolClient, id: string): Promise<void> {
  await client.query('DELETE FROM <schema>.<table> WHERE id = $1', [id])
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

---

## Anti-patterns (DO NOT)

- **DO NOT** use `getPool().query()` for user data — always `withUser()`
- **DO NOT** use string interpolation in SQL — always parameterised queries
- **DO NOT** create tables without RLS policies
- **DO NOT** use `CREATE POLICY IF NOT EXISTS` — not supported in PostgreSQL 16.11
- **DO NOT** install Prisma, Drizzle, TypeORM, or any ORM
- **DO NOT** create tables in the `public` schema — use `core`, `content`, etc.
- **DO NOT** skip the `created_by` column — it's part of the RLS contract
- **DO NOT** use `SERIAL` for IDs — use `uuid primary key default gen_random_uuid()`
- **DO NOT** forget to update `db/schema_registry.yaml` and `db/schema/<ns>/schema.yaml`
- **DO NOT** forget the `updated_at` trigger (`core.trigger_set_updated_at()`)
