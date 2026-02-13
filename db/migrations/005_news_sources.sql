-- Phase 6: News Sources, Tabs & Feed Management
-- RSS/Atom/JSON feed sources, thematic tabs, and M:M linkage

-- ==========================================================================
-- News Sources — RSS/Atom/JSON Feed sources per workspace
-- ==========================================================================

create table if not exists content.news_source (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references core.workspace(id) on delete cascade,
  url             text not null,
  title           text,
  feed_type       text not null default 'rss',       -- 'rss', 'atom', 'json'
  status          text not null default 'active',     -- 'active', 'paused', 'error'
  error_message   text,
  error_count     integer not null default 0,
  last_fetched_at timestamptz,
  created_at      timestamptz not null default now(),
  created_by      uuid references core."user"(id) on delete set null,

  constraint news_source_ws_url_uniq unique (workspace_id, url)
);

create index if not exists news_source_workspace_idx on content.news_source(workspace_id);
create index if not exists news_source_status_idx on content.news_source(workspace_id, status);

-- ==========================================================================
-- News Tabs — thematic groupings (user-created)
-- ==========================================================================

create table if not exists content.news_tab (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references core.workspace(id) on delete cascade,
  name            text not null,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  created_by      uuid references core."user"(id) on delete set null
);

create index if not exists news_tab_workspace_idx on content.news_tab(workspace_id);

-- ==========================================================================
-- News Source ↔ Tab (M:M junction)
-- ==========================================================================

create table if not exists content.news_source_tab (
  source_id       uuid not null references content.news_source(id) on delete cascade,
  tab_id          uuid not null references content.news_tab(id) on delete cascade,
  primary key (source_id, tab_id)
);

-- ==========================================================================
-- ALTER news_item — link to source + dedup guid
-- ==========================================================================

alter table content.news_item add column if not exists source_id uuid references content.news_source(id) on delete set null;
alter table content.news_item add column if not exists guid text;

create unique index if not exists news_item_source_guid_uniq
  on content.news_item(source_id, guid) where guid is not null;
create index if not exists news_item_source_idx
  on content.news_item(source_id) where source_id is not null;

-- ==========================================================================
-- RLS — News Source
-- ==========================================================================

alter table content.news_source enable row level security;

create policy news_source_select_member
on content.news_source
for select
using (core.is_workspace_member(workspace_id));

create policy news_source_insert_member
on content.news_source
for insert
with check (
  core.is_workspace_member(workspace_id)
  and created_by = core.current_user_id()
);

create policy news_source_update_member
on content.news_source
for update
using (core.is_workspace_member(workspace_id))
with check (core.is_workspace_member(workspace_id));

create policy news_source_delete_member
on content.news_source
for delete
using (core.is_workspace_member(workspace_id));

-- ==========================================================================
-- RLS — News Tab
-- ==========================================================================

alter table content.news_tab enable row level security;

create policy news_tab_select_member
on content.news_tab
for select
using (core.is_workspace_member(workspace_id));

create policy news_tab_insert_member
on content.news_tab
for insert
with check (
  core.is_workspace_member(workspace_id)
  and created_by = core.current_user_id()
);

create policy news_tab_update_member
on content.news_tab
for update
using (core.is_workspace_member(workspace_id))
with check (core.is_workspace_member(workspace_id));

create policy news_tab_delete_member
on content.news_tab
for delete
using (core.is_workspace_member(workspace_id));

-- ==========================================================================
-- RLS — News Source Tab (junction) — derived from source's workspace
-- ==========================================================================

alter table content.news_source_tab enable row level security;

create policy news_source_tab_select
on content.news_source_tab
for select
using (
  exists (
    select 1 from content.news_source s
    where s.id = source_id and core.is_workspace_member(s.workspace_id)
  )
);

create policy news_source_tab_insert
on content.news_source_tab
for insert
with check (
  exists (
    select 1 from content.news_source s
    where s.id = source_id and core.is_workspace_member(s.workspace_id)
  )
);

create policy news_source_tab_delete
on content.news_source_tab
for delete
using (
  exists (
    select 1 from content.news_source s
    where s.id = source_id and core.is_workspace_member(s.workspace_id)
  )
);
