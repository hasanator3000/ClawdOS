-- LifeOS local Postgres schema with RLS (multi-workspace)

create extension if not exists pgcrypto;

create schema if not exists app;

-- Users (local auth)
create table if not exists app.users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

-- Workspaces
do $$
begin
  if not exists (select 1 from pg_type where typname = 'workspace_type') then
    create type workspace_type as enum ('personal','shared');
  end if;
end $$;

create table if not exists app.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  type workspace_type not null,
  created_at timestamptz not null default now()
);

create table if not exists app.memberships (
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  user_id uuid not null references app.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists app.news_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  title text not null,
  url text,
  source text,
  published_at timestamptz,
  content text,
  created_at timestamptz not null default now(),
  created_by uuid
);
create index if not exists news_items_workspace_id_idx on app.news_items(workspace_id);
create index if not exists news_items_published_at_idx on app.news_items(published_at desc);

create table if not exists app.digests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  date date not null,
  title text,
  summary text,
  created_at timestamptz not null default now(),
  created_by uuid,
  unique (workspace_id, date)
);
create index if not exists digests_workspace_id_idx on app.digests(workspace_id);
create index if not exists digests_date_idx on app.digests(date desc);

-- Seed workspaces (AG/German/Shared)
insert into app.workspaces (name, slug, type)
values
  ('AG', 'ag', 'personal'),
  ('German', 'german', 'personal'),
  ('Shared', 'shared', 'shared')
on conflict (slug) do update set name = excluded.name, type = excluded.type;

-- ---------- RLS ----------
-- We enforce tenancy using a per-transaction setting: app.user_id.
-- The application MUST set it for every request/transaction:
--   select set_config('app.user_id', '<uuid>', true);

create or replace function app.current_user_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.user_id', true), '')::uuid;
$$;

create or replace function app.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from app.memberships m
    where m.workspace_id = p_workspace_id
      and m.user_id = app.current_user_id()
  );
$$;

alter table app.workspaces enable row level security;
alter table app.memberships enable row level security;
alter table app.news_items enable row level security;
alter table app.digests enable row level security;

-- Workspaces readable only by members
create policy if not exists workspaces_select_member
on app.workspaces
for select
using (app.is_workspace_member(id));

-- Memberships readable only for the current user
create policy if not exists memberships_select_self
on app.memberships
for select
using (user_id = app.current_user_id());

-- News: members can CRUD within workspace
create policy if not exists news_select_member
on app.news_items
for select
using (app.is_workspace_member(workspace_id));

create policy if not exists news_insert_member
on app.news_items
for insert
with check (
  app.is_workspace_member(workspace_id)
  and created_by = app.current_user_id()
);

create policy if not exists news_update_member
on app.news_items
for update
using (app.is_workspace_member(workspace_id))
with check (app.is_workspace_member(workspace_id));

create policy if not exists news_delete_member
on app.news_items
for delete
using (app.is_workspace_member(workspace_id));

-- Digests: members can CRUD within workspace
create policy if not exists digests_select_member
on app.digests
for select
using (app.is_workspace_member(workspace_id));

create policy if not exists digests_insert_member
on app.digests
for insert
with check (
  app.is_workspace_member(workspace_id)
  and created_by = app.current_user_id()
);

create policy if not exists digests_update_member
on app.digests
for update
using (app.is_workspace_member(workspace_id))
with check (app.is_workspace_member(workspace_id));

create policy if not exists digests_delete_member
on app.digests
for delete
using (app.is_workspace_member(workspace_id));
