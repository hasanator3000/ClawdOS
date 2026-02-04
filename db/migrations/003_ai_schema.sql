-- Phase 3: Agent Core - AI Schema
-- Conversations, messages, tool calls, artifacts, memory

-- ==========================================================================
-- AI Conversations
-- Threads of interaction with the agent
-- ==========================================================================

create table if not exists core.conversation (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references core.workspace(id) on delete cascade,
  user_id       uuid not null references core."user"(id) on delete cascade,

  -- Metadata
  title         text,                    -- Optional title (auto-generated or user-set)
  context       jsonb not null default '{}',  -- Page context, workspace state, etc.

  -- Status
  status        text not null default 'active',  -- 'active', 'archived'

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists conversation_workspace_idx on core.conversation(workspace_id);
create index if not exists conversation_user_idx on core.conversation(user_id);
create index if not exists conversation_updated_idx on core.conversation(workspace_id, updated_at desc);

alter table core.conversation enable row level security;

create policy if not exists conversation_select_owner
on core.conversation
for select
using (user_id = core.current_user_id());

create policy if not exists conversation_insert_owner
on core.conversation
for insert
with check (user_id = core.current_user_id());

create policy if not exists conversation_update_owner
on core.conversation
for update
using (user_id = core.current_user_id())
with check (user_id = core.current_user_id());

create policy if not exists conversation_delete_owner
on core.conversation
for delete
using (user_id = core.current_user_id());

-- ==========================================================================
-- AI Messages
-- Individual messages in a conversation
-- ==========================================================================

create table if not exists core.message (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references core.conversation(id) on delete cascade,

  -- Message content
  role            text not null,           -- 'user', 'assistant', 'system'
  content         text,                    -- Text content (may be null if only tool calls)

  -- For assistant messages - model info
  model           text,                    -- 'claude-3-opus', etc.
  finish_reason   text,                    -- 'stop', 'tool_use', etc.

  -- Tokens used (for tracking)
  input_tokens    integer,
  output_tokens   integer,

  -- Metadata
  metadata        jsonb not null default '{}',

  created_at      timestamptz not null default now()
);

create index if not exists message_conversation_idx on core.message(conversation_id);
create index if not exists message_created_idx on core.message(conversation_id, created_at asc);

alter table core.message enable row level security;

-- RLS via conversation ownership
create policy if not exists message_select_owner
on core.message
for select
using (
  exists (
    select 1 from core.conversation c
    where c.id = message.conversation_id
    and c.user_id = core.current_user_id()
  )
);

create policy if not exists message_insert_owner
on core.message
for insert
with check (
  exists (
    select 1 from core.conversation c
    where c.id = message.conversation_id
    and c.user_id = core.current_user_id()
  )
);

-- ==========================================================================
-- Tool Calls
-- Tool/skill invocations by the assistant
-- ==========================================================================

create table if not exists core.tool_call (
  id              uuid primary key default gen_random_uuid(),
  message_id      uuid not null references core.message(id) on delete cascade,

  -- Tool identification
  tool_name       text not null,           -- 'create_task', 'search_news', etc.
  tool_call_id    text not null,           -- Anthropic's tool_use_id

  -- Input/Output
  input           jsonb not null,          -- Tool input parameters
  output          jsonb,                   -- Tool execution result
  error           text,                    -- Error message if failed

  -- Status
  status          text not null default 'pending',  -- 'pending', 'running', 'success', 'error'
  started_at      timestamptz,
  completed_at    timestamptz,

  created_at      timestamptz not null default now()
);

create index if not exists tool_call_message_idx on core.tool_call(message_id);
create index if not exists tool_call_status_idx on core.tool_call(status) where status != 'success';

alter table core.tool_call enable row level security;

-- RLS via message -> conversation ownership
create policy if not exists tool_call_select_owner
on core.tool_call
for select
using (
  exists (
    select 1 from core.message m
    join core.conversation c on c.id = m.conversation_id
    where m.id = tool_call.message_id
    and c.user_id = core.current_user_id()
  )
);

create policy if not exists tool_call_insert_owner
on core.tool_call
for insert
with check (
  exists (
    select 1 from core.message m
    join core.conversation c on c.id = m.conversation_id
    where m.id = tool_call.message_id
    and c.user_id = core.current_user_id()
  )
);

create policy if not exists tool_call_update_owner
on core.tool_call
for update
using (
  exists (
    select 1 from core.message m
    join core.conversation c on c.id = m.conversation_id
    where m.id = tool_call.message_id
    and c.user_id = core.current_user_id()
  )
);

-- ==========================================================================
-- Artifacts
-- Generated content (code, documents, etc.) from conversations
-- ==========================================================================

create table if not exists core.artifact (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references core.conversation(id) on delete cascade,
  message_id      uuid references core.message(id) on delete set null,

  -- Artifact content
  type            text not null,           -- 'code', 'document', 'image', 'data'
  title           text,
  content         text not null,
  language        text,                    -- For code: 'typescript', 'python', etc.
  mime_type       text,

  -- Versioning
  version         integer not null default 1,

  created_at      timestamptz not null default now()
);

create index if not exists artifact_conversation_idx on core.artifact(conversation_id);
create index if not exists artifact_type_idx on core.artifact(conversation_id, type);

alter table core.artifact enable row level security;

create policy if not exists artifact_select_owner
on core.artifact
for select
using (
  exists (
    select 1 from core.conversation c
    where c.id = artifact.conversation_id
    and c.user_id = core.current_user_id()
  )
);

create policy if not exists artifact_insert_owner
on core.artifact
for insert
with check (
  exists (
    select 1 from core.conversation c
    where c.id = artifact.conversation_id
    and c.user_id = core.current_user_id()
  )
);

-- ==========================================================================
-- Agent Memory
-- Long-term memory for the agent (facts, preferences, learned patterns)
-- ==========================================================================

create table if not exists core.memory (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references core.workspace(id) on delete cascade,

  -- Memory content
  type            text not null,           -- 'fact', 'preference', 'instruction', 'entity'
  content         text not null,           -- The memory itself
  embedding       vector(1536),            -- For semantic search (optional)

  -- Source tracking
  source_conversation_id uuid references core.conversation(id) on delete set null,
  source_message_id      uuid references core.message(id) on delete set null,

  -- Importance/relevance
  importance      real not null default 0.5,  -- 0-1 scale
  access_count    integer not null default 0,
  last_accessed   timestamptz,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists memory_workspace_idx on core.memory(workspace_id);
create index if not exists memory_type_idx on core.memory(workspace_id, type);
create index if not exists memory_importance_idx on core.memory(workspace_id, importance desc);

-- Vector similarity search index (if pgvector is installed)
-- create index if not exists memory_embedding_idx on core.memory using ivfflat (embedding vector_cosine_ops) with (lists = 100);

alter table core.memory enable row level security;

create policy if not exists memory_select_member
on core.memory
for select
using (core.is_workspace_member(workspace_id));

create policy if not exists memory_insert_member
on core.memory
for insert
with check (core.is_workspace_member(workspace_id));

create policy if not exists memory_update_member
on core.memory
for update
using (core.is_workspace_member(workspace_id))
with check (core.is_workspace_member(workspace_id));

create policy if not exists memory_delete_member
on core.memory
for delete
using (core.is_workspace_member(workspace_id));
