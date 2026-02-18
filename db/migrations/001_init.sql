-- ClawdOS local Postgres schema with RLS (multi-workspace)

create extension if not exists pgcrypto;

-- Schema already exists, just use it
-- create schema if not exists core;

-- Users (local auth)
create table if not exists core."user" (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  telegram_user_id text,
  password_updated_at timestamptz,
  created_at timestamptz not null default now()
);

-- Workspaces
do $$
begin
  if not exists (select 1 from pg_type where typname = 'workspace_type') then
    create type workspace_type as enum ('personal','shared');
  end if;
end $$;

create table if not exists core.workspace (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  kind workspace_type not null,
  created_at timestamptz not null default now()
);

create table if not exists core.membership (
  workspace_id uuid not null references core.workspace(id) on delete cascade,
  user_id uuid not null references core."user"(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists content.news_item (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references core.workspace(id) on delete cascade,
  title text not null,
  url text,
  topic text,
  summary text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid
);
create index if not exists news_item_workspace_id_idx on content.news_item(workspace_id);
create index if not exists news_item_published_at_idx on content.news_item(published_at desc);

create table if not exists content.digest (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references core.workspace(id) on delete cascade,
  date date not null,
  title text,
  body text,
  created_at timestamptz not null default now(),
  created_by uuid,
  unique (workspace_id, date)
);
create index if not exists digest_workspace_id_idx on content.digest(workspace_id);
create index if not exists digest_date_idx on content.digest(date desc);

-- Seed workspaces (AG/German/Shared)
insert into core.workspace (name, slug, kind)
values
  ('AG', 'ag', 'personal'),
  ('German', 'german', 'personal'),
  ('Shared', 'shared', 'shared')
on conflict (slug) do update set name = excluded.name, kind = excluded.kind;

-- ---------- RLS ----------
-- We enforce tenancy using a per-transaction setting: app.user_id.
-- The application MUST set it for every request/transaction:
--   select set_config('app.user_id', '<uuid>', true);

create or replace function core.current_user_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.user_id', true), '')::uuid;
$$;

create or replace function core.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from core.membership m
    where m.workspace_id = p_workspace_id
      and m.user_id = core.current_user_id()
  );
$$;

alter table core.workspace enable row level security;
alter table core.membership enable row level security;
alter table content.news_item enable row level security;
alter table content.digest enable row level security;

-- Workspaces readable only by members
create policy if not exists workspaces_select_member
on core.workspace
for select
using (core.is_workspace_member(id));

-- Memberships readable only for the current user
create policy if not exists memberships_select_self
on core.membership
for select
using (user_id = core.current_user_id());

-- News: members can CRUD within workspace
create policy if not exists news_select_member
on content.news_item
for select
using (core.is_workspace_member(workspace_id));

create policy if not exists news_insert_member
on content.news_item
for insert
with check (
  core.is_workspace_member(workspace_id)
  and created_by = core.current_user_id()
);

create policy if not exists news_update_member
on content.news_item
for update
using (core.is_workspace_member(workspace_id))
with check (core.is_workspace_member(workspace_id));

create policy if not exists news_delete_member
on content.news_item
for delete
using (core.is_workspace_member(workspace_id));

-- Digests: members can CRUD within workspace
create policy if not exists digests_select_member
on content.digest
for select
using (core.is_workspace_member(workspace_id));

create policy if not exists digests_insert_member
on content.digest
for insert
with check (
  core.is_workspace_member(workspace_id)
  and created_by = core.current_user_id()
);

create policy if not exists digests_update_member
on content.digest
for update
using (core.is_workspace_member(workspace_id))
with check (core.is_workspace_member(workspace_id));

create policy if not exists digests_delete_member
on content.digest
for delete
using (core.is_workspace_member(workspace_id));
