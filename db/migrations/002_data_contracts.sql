-- Phase 2: Data Contracts
-- Event log, entities, settings, files

-- ==========================================================================
-- TASK 2.1: Event Log
-- Captures all entity changes with monotonic revision numbering
-- ==========================================================================

create table if not exists core.event_log (
  id            bigserial primary key,
  workspace_id  uuid not null references core.workspace(id) on delete cascade,
  user_id       uuid references core."user"(id) on delete set null,

  -- What changed
  entity_type   text not null,           -- 'task', 'note', 'file', etc.
  entity_id     uuid not null,           -- ID of the changed entity
  action        text not null,           -- 'create', 'update', 'delete'

  -- Change details
  revision      bigint not null,         -- Monotonic within entity
  changes       jsonb,                   -- Delta or full state

  created_at    timestamptz not null default now()
);

create index if not exists event_log_workspace_idx on core.event_log(workspace_id);
create index if not exists event_log_entity_idx on core.event_log(entity_type, entity_id);
create index if not exists event_log_created_at_idx on core.event_log(created_at desc);
create unique index if not exists event_log_revision_idx on core.event_log(entity_type, entity_id, revision);

-- RLS for event_log
alter table core.event_log enable row level security;

create policy if not exists event_log_select_member
on core.event_log
for select
using (core.is_workspace_member(workspace_id));

create policy if not exists event_log_insert_member
on core.event_log
for insert
with check (
  core.is_workspace_member(workspace_id)
  and user_id = core.current_user_id()
);

-- ==========================================================================
-- TASK 2.2: Universal Entity + Links
-- Flexible entity storage for arbitrary data types
-- ==========================================================================

create table if not exists core.entity (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references core.workspace(id) on delete cascade,

  -- Entity type and identity
  type          text not null,           -- 'note', 'bookmark', 'snippet', etc.
  slug          text,                    -- Optional human-readable identifier

  -- Content
  title         text,
  content       text,
  data          jsonb not null default '{}',

  -- Metadata
  tags          text[] not null default '{}',

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references core."user"(id) on delete set null,

  unique (workspace_id, type, slug)
);

create index if not exists entity_workspace_idx on core.entity(workspace_id);
create index if not exists entity_type_idx on core.entity(workspace_id, type);
create index if not exists entity_tags_idx on core.entity using gin(tags);

-- RLS for entity
alter table core.entity enable row level security;

create policy if not exists entity_select_member
on core.entity
for select
using (core.is_workspace_member(workspace_id));

create policy if not exists entity_insert_member
on core.entity
for insert
with check (
  core.is_workspace_member(workspace_id)
  and created_by = core.current_user_id()
);

create policy if not exists entity_update_member
on core.entity
for update
using (core.is_workspace_member(workspace_id))
with check (core.is_workspace_member(workspace_id));

create policy if not exists entity_delete_member
on core.entity
for delete
using (core.is_workspace_member(workspace_id));

-- Entity links (graph relationships)
create table if not exists core.entity_link (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references core.workspace(id) on delete cascade,

  -- Link endpoints
  source_id     uuid not null references core.entity(id) on delete cascade,
  target_id     uuid not null references core.entity(id) on delete cascade,

  -- Relationship type
  relation      text not null,           -- 'parent', 'related', 'blocks', etc.

  -- Optional metadata
  data          jsonb not null default '{}',

  created_at    timestamptz not null default now(),
  created_by    uuid references core."user"(id) on delete set null,

  unique (source_id, target_id, relation)
);

create index if not exists entity_link_workspace_idx on core.entity_link(workspace_id);
create index if not exists entity_link_source_idx on core.entity_link(source_id);
create index if not exists entity_link_target_idx on core.entity_link(target_id);

-- RLS for entity_link
alter table core.entity_link enable row level security;

create policy if not exists entity_link_select_member
on core.entity_link
for select
using (core.is_workspace_member(workspace_id));

create policy if not exists entity_link_insert_member
on core.entity_link
for insert
with check (
  core.is_workspace_member(workspace_id)
  and created_by = core.current_user_id()
);

create policy if not exists entity_link_delete_member
on core.entity_link
for delete
using (core.is_workspace_member(workspace_id));

-- ==========================================================================
-- TASK 2.3: Settings Tables
-- User and workspace preferences
-- ==========================================================================

create table if not exists core.user_setting (
  user_id       uuid not null references core."user"(id) on delete cascade,
  key           text not null,
  value         jsonb not null,
  updated_at    timestamptz not null default now(),

  primary key (user_id, key)
);

-- No RLS needed - filtered by user_id in queries
-- But add policy for safety
alter table core.user_setting enable row level security;

create policy if not exists user_setting_select_self
on core.user_setting
for select
using (user_id = core.current_user_id());

create policy if not exists user_setting_insert_self
on core.user_setting
for insert
with check (user_id = core.current_user_id());

create policy if not exists user_setting_update_self
on core.user_setting
for update
using (user_id = core.current_user_id())
with check (user_id = core.current_user_id());

create policy if not exists user_setting_delete_self
on core.user_setting
for delete
using (user_id = core.current_user_id());

-- Workspace settings
create table if not exists core.workspace_setting (
  workspace_id  uuid not null references core.workspace(id) on delete cascade,
  key           text not null,
  value         jsonb not null,
  updated_at    timestamptz not null default now(),

  primary key (workspace_id, key)
);

alter table core.workspace_setting enable row level security;

create policy if not exists workspace_setting_select_member
on core.workspace_setting
for select
using (core.is_workspace_member(workspace_id));

create policy if not exists workspace_setting_insert_member
on core.workspace_setting
for insert
with check (core.is_workspace_member(workspace_id));

create policy if not exists workspace_setting_update_member
on core.workspace_setting
for update
using (core.is_workspace_member(workspace_id))
with check (core.is_workspace_member(workspace_id));

create policy if not exists workspace_setting_delete_member
on core.workspace_setting
for delete
using (core.is_workspace_member(workspace_id));

-- ==========================================================================
-- TASK 2.4: Files Schema
-- File metadata and folder structure
-- ==========================================================================

create table if not exists core.folder (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references core.workspace(id) on delete cascade,
  parent_id     uuid references core.folder(id) on delete cascade,

  name          text not null,

  created_at    timestamptz not null default now(),
  created_by    uuid references core."user"(id) on delete set null
);

create index if not exists folder_workspace_idx on core.folder(workspace_id);
create index if not exists folder_parent_idx on core.folder(parent_id);

alter table core.folder enable row level security;

create policy if not exists folder_select_member
on core.folder
for select
using (core.is_workspace_member(workspace_id));

create policy if not exists folder_insert_member
on core.folder
for insert
with check (
  core.is_workspace_member(workspace_id)
  and created_by = core.current_user_id()
);

create policy if not exists folder_update_member
on core.folder
for update
using (core.is_workspace_member(workspace_id))
with check (core.is_workspace_member(workspace_id));

create policy if not exists folder_delete_member
on core.folder
for delete
using (core.is_workspace_member(workspace_id));

create table if not exists core.file (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references core.workspace(id) on delete cascade,
  folder_id     uuid references core.folder(id) on delete set null,

  -- File info
  name          text not null,
  mime_type     text not null,
  size_bytes    bigint not null,

  -- Storage
  storage_path  text not null,           -- Relative path on disk
  checksum      text,                    -- SHA-256 hash

  -- Metadata
  metadata      jsonb not null default '{}',

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references core."user"(id) on delete set null
);

create index if not exists file_workspace_idx on core.file(workspace_id);
create index if not exists file_folder_idx on core.file(folder_id);
create index if not exists file_mime_type_idx on core.file(workspace_id, mime_type);

alter table core.file enable row level security;

create policy if not exists file_select_member
on core.file
for select
using (core.is_workspace_member(workspace_id));

create policy if not exists file_insert_member
on core.file
for insert
with check (
  core.is_workspace_member(workspace_id)
  and created_by = core.current_user_id()
);

create policy if not exists file_update_member
on core.file
for update
using (core.is_workspace_member(workspace_id))
with check (core.is_workspace_member(workspace_id));

create policy if not exists file_delete_member
on core.file
for delete
using (core.is_workspace_member(workspace_id));
