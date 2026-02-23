-- Phase 8: Projects
-- Project grouping for tasks

create table if not exists core.project (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references core.workspace(id) on delete cascade,
  name            text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists project_workspace_idx on core.project(workspace_id);

-- RLS for projects
alter table core.project enable row level security;

create policy if not exists project_select_member
on core.project for select
using (core.is_workspace_member(workspace_id));

create policy if not exists project_insert_member
on core.project for insert
with check (core.is_workspace_member(workspace_id));

create policy if not exists project_update_member
on core.project for update
using (core.is_workspace_member(workspace_id))
with check (core.is_workspace_member(workspace_id));

create policy if not exists project_delete_member
on core.project for delete
using (core.is_workspace_member(workspace_id));

-- Add FK from task.project_id to project
alter table core.task
  add constraint task_project_fk
  foreign key (project_id) references core.project(id)
  on delete set null;

create index if not exists task_project_idx on core.task(project_id) where project_id is not null;
