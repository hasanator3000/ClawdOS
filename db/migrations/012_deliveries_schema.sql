-- Migration 012: deliveries schema
-- Adds package/shipment tracking with TrackingMore integration

begin;

-- ===================== TABLES =====================

create table if not exists content.delivery (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references core.workspace(id) on delete cascade,

  -- Tracking
  tracking_number text not null,
  courier_code    text,
  courier_name    text,
  title           text,

  -- Status
  status          text not null default 'pending'
    check (status in ('pending', 'transit', 'pickup', 'delivered', 'expired', 'undelivered')),
  substatus       text,

  -- Location
  origin          text,
  destination     text,

  -- Timeline
  eta             timestamptz,
  last_event      text,
  last_event_at   timestamptz,

  -- TrackingMore
  trackingmore_id text,

  -- Events (array of tracking events from TrackingMore)
  events          jsonb not null default '[]',

  -- Audit
  created_by      uuid references core."user"(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ===================== TRIGGERS =====================

create trigger set_delivery_updated_at
  before update on content.delivery
  for each row execute function core.trigger_set_updated_at();

-- ===================== INDEXES =====================

create index if not exists delivery_workspace_idx
  on content.delivery (workspace_id);

create index if not exists delivery_workspace_status_idx
  on content.delivery (workspace_id, status);

create index if not exists delivery_tracking_number_idx
  on content.delivery (tracking_number);

-- Unique: one tracking number per workspace
create unique index if not exists delivery_ws_tracking_uniq
  on content.delivery (workspace_id, tracking_number);

-- ===================== RLS =====================

alter table content.delivery enable row level security;

drop policy if exists "delivery_select" on content.delivery;
create policy "delivery_select"
  on content.delivery for select
  using (core.is_workspace_member(workspace_id));

drop policy if exists "delivery_insert" on content.delivery;
create policy "delivery_insert"
  on content.delivery for insert
  with check (
    core.is_workspace_member(workspace_id)
    and created_by = core.current_user_id()
  );

drop policy if exists "delivery_update" on content.delivery;
create policy "delivery_update"
  on content.delivery for update
  using (core.is_workspace_member(workspace_id))
  with check (core.is_workspace_member(workspace_id));

drop policy if exists "delivery_delete" on content.delivery;
create policy "delivery_delete"
  on content.delivery for delete
  using (core.is_workspace_member(workspace_id));

commit;
