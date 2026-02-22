-- Migration 008: Processes schema
-- Adds scheduled processes table with RLS for workspace isolation

begin;

-- ===================== TABLES =====================

create table if not exists content.processes (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references core.workspace(id) on delete cascade,

  -- Content
  title           text not null,
  description     text,

  -- Schedule configuration
  schedule        text not null,  -- cron format: "0 9 * * *"
  action_type     text not null
    check (action_type in ('send_digest', 'send_reminder', 'run_backup')),
  action_config   jsonb not null default '{}',

  -- Status and tracking
  enabled         boolean not null default true,
  last_run_at     timestamptz,
  next_run_at     timestamptz,

  -- Audit
  created_by      uuid references core."user"(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ===================== TRIGGERS =====================

-- Auto-update updated_at (uses existing trigger function from 001_init.sql)
create trigger set_processes_updated_at
  before update on content.processes
  for each row execute function core.trigger_set_updated_at();

-- ===================== INDEXES =====================

create index if not exists processes_workspace_idx
  on content.processes (workspace_id);

create index if not exists processes_enabled_idx
  on content.processes (enabled) where enabled = true;

create index if not exists processes_next_run_idx
  on content.processes (workspace_id, next_run_at) where enabled = true;

-- ===================== RLS =====================

alter table content.processes enable row level security;

-- SELECT: workspace members can read
create policy "processes_select"
  on content.processes for select
  using (core.is_workspace_member(workspace_id));

-- INSERT: workspace members can create, must set created_by
create policy "processes_insert"
  on content.processes for insert
  with check (
    core.is_workspace_member(workspace_id)
    and created_by = core.current_user_id()
  );

-- UPDATE: workspace members can update
create policy "processes_update"
  on content.processes for update
  using (core.is_workspace_member(workspace_id))
  with check (core.is_workspace_member(workspace_id));

-- DELETE: workspace members can delete
create policy "processes_delete"
  on content.processes for delete
  using (core.is_workspace_member(workspace_id));

commit;
