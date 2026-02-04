-- Phase 5: Tasks Skill
-- Task management tables

-- ==========================================================================
-- Tasks Table
-- Main task storage with status, priority, and due dates
-- ==========================================================================

create table if not exists core.task (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references core.workspace(id) on delete cascade,
  parent_id       uuid references core.task(id) on delete cascade,

  -- Content
  title           text not null,
  description     text,

  -- Status and priority
  status          text not null default 'todo',  -- 'todo', 'in_progress', 'done', 'cancelled'
  priority        integer not null default 0,     -- 0=none, 1=low, 2=medium, 3=high, 4=urgent

  -- Due date
  due_date        date,
  due_time        time,

  -- Organization
  tags            text[] not null default '{}',
  project_id      uuid,                           -- Optional project grouping

  -- Assignment
  assignee_id     uuid references core."user"(id) on delete set null,

  -- Timestamps
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  completed_at    timestamptz,
  created_by      uuid references core."user"(id) on delete set null
);

create index if not exists task_workspace_idx on core.task(workspace_id);
create index if not exists task_status_idx on core.task(workspace_id, status);
create index if not exists task_due_date_idx on core.task(workspace_id, due_date) where due_date is not null;
create index if not exists task_parent_idx on core.task(parent_id) where parent_id is not null;
create index if not exists task_tags_idx on core.task using gin(tags);

-- RLS for tasks
alter table core.task enable row level security;

create policy if not exists task_select_member
on core.task
for select
using (core.is_workspace_member(workspace_id));

create policy if not exists task_insert_member
on core.task
for insert
with check (
  core.is_workspace_member(workspace_id)
  and created_by = core.current_user_id()
);

create policy if not exists task_update_member
on core.task
for update
using (core.is_workspace_member(workspace_id))
with check (core.is_workspace_member(workspace_id));

create policy if not exists task_delete_member
on core.task
for delete
using (core.is_workspace_member(workspace_id));
