-- LifeOS — Baseline Schema (auto-generated from live database)
-- This file is used for FRESH installs. For upgrades, use db/migrations/.
--
-- Usage:  psql $DATABASE_URL < db/schema.sql
-- Or via: node scripts/setup.mjs (which applies this automatically)

BEGIN;

CREATE SCHEMA IF NOT EXISTS content;
CREATE SCHEMA IF NOT EXISTS core;

CREATE FUNCTION core.current_user_id() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select nullif(current_setting('app.user_id', true), '')::uuid;
$$;

CREATE FUNCTION core.is_workspace_member(p_workspace_id uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select exists (
    select 1
    from core.membership m
    where m.workspace_id = p_workspace_id
      and m.user_id = core.current_user_id()
  );
$$;

CREATE FUNCTION core.trigger_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE content.digest (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    date date NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);

CREATE TABLE content.news_item (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    topic text NOT NULL,
    title text NOT NULL,
    url text NOT NULL,
    summary text NOT NULL,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    source_id uuid,
    guid text,
    image_url text,
    CONSTRAINT news_item_topic_check CHECK ((topic = ANY (ARRAY['world'::text, 'ai'::text, 'other'::text])))
);

CREATE TABLE content.news_source (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    url text NOT NULL,
    title text,
    feed_type text DEFAULT 'rss'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    error_message text,
    error_count integer DEFAULT 0 NOT NULL,
    last_fetched_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);

CREATE TABLE content.news_source_tab (
    source_id uuid NOT NULL,
    tab_id uuid NOT NULL
);

CREATE TABLE content.news_tab (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);

CREATE TABLE core._migrations (
    id text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE core.artifact (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    message_id uuid,
    type text NOT NULL,
    title text,
    content text NOT NULL,
    language text,
    mime_type text,
    version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE core.auth_challenge (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    kind text NOT NULL,
    code text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    consumed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT auth_challenge_kind_check CHECK ((kind = ANY (ARRAY['login'::text, 'recovery'::text, 'link'::text])))
);

CREATE TABLE core.conversation (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    user_id uuid NOT NULL,
    title text,
    context jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE core.entity (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    type text NOT NULL,
    slug text,
    title text,
    content text,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);

CREATE TABLE core.entity_link (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    source_id uuid NOT NULL,
    target_id uuid NOT NULL,
    relation text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);

CREATE TABLE core.event_log (
    id bigint NOT NULL,
    workspace_id uuid NOT NULL,
    user_id uuid,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    action text NOT NULL,
    revision bigint NOT NULL,
    changes jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE core.event_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE core.event_log_id_seq OWNED BY core.event_log.id;

CREATE TABLE core.file (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    folder_id uuid,
    name text NOT NULL,
    mime_type text NOT NULL,
    size_bytes bigint NOT NULL,
    storage_path text NOT NULL,
    checksum text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);

CREATE TABLE core.folder (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    parent_id uuid,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);

CREATE TABLE core.membership (
    workspace_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workspace_member_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'member'::text])))
);

CREATE TABLE core.memory (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    type text NOT NULL,
    content text NOT NULL,
    source_conversation_id uuid,
    source_message_id uuid,
    importance real DEFAULT 0.5 NOT NULL,
    access_count integer DEFAULT 0 NOT NULL,
    last_accessed timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE core.message (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    role text NOT NULL,
    content text,
    model text,
    finish_reason text,
    input_tokens integer,
    output_tokens integer,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE core.schema_migration (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    schema_name text NOT NULL,
    version integer NOT NULL,
    description text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE core.task (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    parent_id uuid,
    title text NOT NULL,
    description text,
    status text DEFAULT 'todo'::text NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    due_date date,
    due_time time without time zone,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    project_id uuid,
    assignee_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    created_by uuid
);

CREATE TABLE core.telegram_outbox (
    id bigint NOT NULL,
    telegram_user_id bigint NOT NULL,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    sent_at timestamp with time zone
);

CREATE SEQUENCE core.telegram_outbox_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE core.telegram_outbox_id_seq OWNED BY core.telegram_outbox.id;

CREATE TABLE core.tool_call (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    tool_name text NOT NULL,
    tool_call_id text NOT NULL,
    input jsonb NOT NULL,
    output jsonb,
    error text,
    status text DEFAULT 'pending'::text NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE core."user" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    username text NOT NULL,
    password_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    telegram_user_id bigint,
    password_updated_at timestamp with time zone,
    CONSTRAINT app_user_username_check CHECK (((char_length(username) >= 3) AND (char_length(username) <= 32)))
);

CREATE TABLE core.user_setting (
    user_id uuid NOT NULL,
    key text NOT NULL,
    value jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE core.workspace (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    kind text NOT NULL,
    owner_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workspace_kind_check CHECK ((kind = ANY (ARRAY['personal'::text, 'shared'::text])))
);

CREATE TABLE core.workspace_setting (
    workspace_id uuid NOT NULL,
    key text NOT NULL,
    value jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY core.event_log ALTER COLUMN id SET DEFAULT nextval('core.event_log_id_seq'::regclass);

ALTER TABLE ONLY core.telegram_outbox ALTER COLUMN id SET DEFAULT nextval('core.telegram_outbox_id_seq'::regclass);

ALTER TABLE ONLY content.digest
    ADD CONSTRAINT digest_pkey PRIMARY KEY (id);

ALTER TABLE ONLY content.digest
    ADD CONSTRAINT digest_workspace_id_date_key UNIQUE (workspace_id, date);

ALTER TABLE ONLY content.news_item
    ADD CONSTRAINT news_item_pkey PRIMARY KEY (id);

ALTER TABLE ONLY content.news_source
    ADD CONSTRAINT news_source_pkey PRIMARY KEY (id);

ALTER TABLE ONLY content.news_source_tab
    ADD CONSTRAINT news_source_tab_pkey PRIMARY KEY (source_id, tab_id);

ALTER TABLE ONLY content.news_source
    ADD CONSTRAINT news_source_ws_url_uniq UNIQUE (workspace_id, url);

ALTER TABLE ONLY content.news_tab
    ADD CONSTRAINT news_tab_pkey PRIMARY KEY (id);

ALTER TABLE ONLY core._migrations
    ADD CONSTRAINT _migrations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY core."user"
    ADD CONSTRAINT app_user_pkey PRIMARY KEY (id);

ALTER TABLE ONLY core."user"
    ADD CONSTRAINT app_user_username_key UNIQUE (username);

ALTER TABLE ONLY core.artifact
    ADD CONSTRAINT artifact_pkey PRIMARY KEY (id);

ALTER TABLE ONLY core.auth_challenge
    ADD CONSTRAINT auth_challenge_pkey PRIMARY KEY (id);

ALTER TABLE ONLY core.conversation
    ADD CONSTRAINT conversation_pkey PRIMARY KEY (id);

ALTER TABLE ONLY core.entity_link
    ADD CONSTRAINT entity_link_pkey PRIMARY KEY (id);

ALTER TABLE ONLY core.entity_link
    ADD CONSTRAINT entity_link_source_id_target_id_relation_key UNIQUE (source_id, target_id, relation);

ALTER TABLE ONLY core.entity
    ADD CONSTRAINT entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY core.entity
    ADD CONSTRAINT entity_workspace_id_type_slug_key UNIQUE (workspace_id, type, slug);

ALTER TABLE ONLY core.event_log
    ADD CONSTRAINT event_log_pkey PRIMARY KEY (id);

ALTER TABLE ONLY core.file
    ADD CONSTRAINT file_pkey PRIMARY KEY (id);

ALTER TABLE ONLY core.folder
    ADD CONSTRAINT folder_pkey PRIMARY KEY (id);

ALTER TABLE ONLY core.memory
    ADD CONSTRAINT memory_pkey PRIMARY KEY (id);

ALTER TABLE ONLY core.message
    ADD CONSTRAINT message_pkey PRIMARY KEY (id);

ALTER TABLE ONLY core.schema_migration
    ADD CONSTRAINT schema_migration_pkey PRIMARY KEY (id);

ALTER TABLE ONLY core.schema_migration
    ADD CONSTRAINT schema_migration_schema_name_version_key UNIQUE (schema_name, version);

ALTER TABLE ONLY core.task
    ADD CONSTRAINT task_pkey PRIMARY KEY (id);

ALTER TABLE ONLY core.telegram_outbox
    ADD CONSTRAINT telegram_outbox_pkey PRIMARY KEY (id);

ALTER TABLE ONLY core.tool_call
    ADD CONSTRAINT tool_call_pkey PRIMARY KEY (id);

ALTER TABLE ONLY core.user_setting
    ADD CONSTRAINT user_setting_pkey PRIMARY KEY (user_id, key);

ALTER TABLE ONLY core.membership
    ADD CONSTRAINT workspace_member_pkey PRIMARY KEY (workspace_id, user_id);

ALTER TABLE ONLY core.workspace
    ADD CONSTRAINT workspace_pkey PRIMARY KEY (id);

ALTER TABLE ONLY core.workspace_setting
    ADD CONSTRAINT workspace_setting_pkey PRIMARY KEY (workspace_id, key);

ALTER TABLE ONLY core.workspace
    ADD CONSTRAINT workspace_slug_key UNIQUE (slug);

CREATE INDEX digest_date_idx ON content.digest USING btree (date DESC);

CREATE INDEX digest_workspace_id_idx ON content.digest USING btree (workspace_id);

CREATE INDEX news_item_published_at_idx ON content.news_item USING btree (published_at DESC);

CREATE UNIQUE INDEX news_item_source_guid_uniq ON content.news_item USING btree (source_id, guid) WHERE (guid IS NOT NULL);

CREATE INDEX news_item_source_idx ON content.news_item USING btree (source_id) WHERE (source_id IS NOT NULL);

CREATE INDEX news_item_workspace_id_idx ON content.news_item USING btree (workspace_id);

CREATE INDEX news_item_ws_published_idx ON content.news_item USING btree (workspace_id, published_at DESC NULLS LAST, id);

CREATE INDEX news_item_ws_topic_created_idx ON content.news_item USING btree (workspace_id, topic, created_at DESC);

CREATE INDEX news_source_status_idx ON content.news_source USING btree (workspace_id, status);

CREATE INDEX news_source_tab_tab_idx ON content.news_source_tab USING btree (tab_id);

CREATE INDEX news_source_workspace_idx ON content.news_source USING btree (workspace_id);

CREATE INDEX news_tab_workspace_idx ON content.news_tab USING btree (workspace_id);

CREATE INDEX artifact_conversation_idx ON core.artifact USING btree (conversation_id);

CREATE INDEX artifact_type_idx ON core.artifact USING btree (conversation_id, type);

CREATE INDEX auth_challenge_expires_idx ON core.auth_challenge USING btree (expires_at);

CREATE INDEX auth_challenge_user_created_idx ON core.auth_challenge USING btree (user_id, created_at DESC);

CREATE INDEX conversation_updated_idx ON core.conversation USING btree (workspace_id, updated_at DESC);

CREATE INDEX conversation_user_idx ON core.conversation USING btree (user_id);

CREATE INDEX conversation_workspace_idx ON core.conversation USING btree (workspace_id);

CREATE INDEX entity_link_source_idx ON core.entity_link USING btree (source_id);

CREATE INDEX entity_link_target_idx ON core.entity_link USING btree (target_id);

CREATE INDEX entity_link_workspace_idx ON core.entity_link USING btree (workspace_id);

CREATE INDEX entity_tags_idx ON core.entity USING gin (tags);

CREATE INDEX entity_type_idx ON core.entity USING btree (workspace_id, type);

CREATE INDEX entity_workspace_idx ON core.entity USING btree (workspace_id);

CREATE INDEX event_log_created_at_idx ON core.event_log USING btree (created_at DESC);

CREATE INDEX event_log_entity_idx ON core.event_log USING btree (entity_type, entity_id);

CREATE UNIQUE INDEX event_log_revision_idx ON core.event_log USING btree (entity_type, entity_id, revision);

CREATE INDEX event_log_workspace_idx ON core.event_log USING btree (workspace_id);

CREATE INDEX file_folder_idx ON core.file USING btree (folder_id);

CREATE INDEX file_mime_type_idx ON core.file USING btree (workspace_id, mime_type);

CREATE INDEX file_workspace_idx ON core.file USING btree (workspace_id);

CREATE INDEX folder_parent_idx ON core.folder USING btree (parent_id);

CREATE INDEX folder_workspace_idx ON core.folder USING btree (workspace_id);

CREATE INDEX memory_importance_idx ON core.memory USING btree (workspace_id, importance DESC);

CREATE INDEX memory_type_idx ON core.memory USING btree (workspace_id, type);

CREATE INDEX memory_workspace_idx ON core.memory USING btree (workspace_id);

CREATE INDEX message_conversation_idx ON core.message USING btree (conversation_id);

CREATE INDEX message_created_idx ON core.message USING btree (conversation_id, created_at);

CREATE INDEX task_due_date_idx ON core.task USING btree (workspace_id, due_date) WHERE (due_date IS NOT NULL);

CREATE INDEX task_parent_idx ON core.task USING btree (parent_id) WHERE (parent_id IS NOT NULL);

CREATE INDEX task_status_idx ON core.task USING btree (workspace_id, status);

CREATE INDEX task_tags_idx ON core.task USING gin (tags);

CREATE INDEX task_workspace_idx ON core.task USING btree (workspace_id);

CREATE INDEX telegram_outbox_unsent_idx ON core.telegram_outbox USING btree (created_at) WHERE (sent_at IS NULL);

CREATE INDEX tool_call_message_idx ON core.tool_call USING btree (message_id);

CREATE INDEX tool_call_status_idx ON core.tool_call USING btree (status) WHERE (status <> 'success'::text);

ALTER TABLE ONLY content.digest
    ADD CONSTRAINT digest_created_by_fkey FOREIGN KEY (created_by) REFERENCES core."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY content.digest
    ADD CONSTRAINT digest_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES core.workspace(id) ON DELETE CASCADE;

ALTER TABLE ONLY content.news_item
    ADD CONSTRAINT news_item_created_by_fkey FOREIGN KEY (created_by) REFERENCES core."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY content.news_item
    ADD CONSTRAINT news_item_source_id_fkey FOREIGN KEY (source_id) REFERENCES content.news_source(id) ON DELETE SET NULL;

ALTER TABLE ONLY content.news_item
    ADD CONSTRAINT news_item_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES core.workspace(id) ON DELETE CASCADE;

ALTER TABLE ONLY content.news_source
    ADD CONSTRAINT news_source_created_by_fkey FOREIGN KEY (created_by) REFERENCES core."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY content.news_source_tab
    ADD CONSTRAINT news_source_tab_source_id_fkey FOREIGN KEY (source_id) REFERENCES content.news_source(id) ON DELETE CASCADE;

ALTER TABLE ONLY content.news_source_tab
    ADD CONSTRAINT news_source_tab_tab_id_fkey FOREIGN KEY (tab_id) REFERENCES content.news_tab(id) ON DELETE CASCADE;

ALTER TABLE ONLY content.news_source
    ADD CONSTRAINT news_source_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES core.workspace(id) ON DELETE CASCADE;

ALTER TABLE ONLY content.news_tab
    ADD CONSTRAINT news_tab_created_by_fkey FOREIGN KEY (created_by) REFERENCES core."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY content.news_tab
    ADD CONSTRAINT news_tab_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES core.workspace(id) ON DELETE CASCADE;

ALTER TABLE ONLY core.artifact
    ADD CONSTRAINT artifact_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES core.conversation(id) ON DELETE CASCADE;

ALTER TABLE ONLY core.artifact
    ADD CONSTRAINT artifact_message_id_fkey FOREIGN KEY (message_id) REFERENCES core.message(id) ON DELETE SET NULL;

ALTER TABLE ONLY core.auth_challenge
    ADD CONSTRAINT auth_challenge_user_id_fkey FOREIGN KEY (user_id) REFERENCES core."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY core.conversation
    ADD CONSTRAINT conversation_user_id_fkey FOREIGN KEY (user_id) REFERENCES core."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY core.conversation
    ADD CONSTRAINT conversation_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES core.workspace(id) ON DELETE CASCADE;

ALTER TABLE ONLY core.entity
    ADD CONSTRAINT entity_created_by_fkey FOREIGN KEY (created_by) REFERENCES core."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY core.entity_link
    ADD CONSTRAINT entity_link_created_by_fkey FOREIGN KEY (created_by) REFERENCES core."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY core.entity_link
    ADD CONSTRAINT entity_link_source_id_fkey FOREIGN KEY (source_id) REFERENCES core.entity(id) ON DELETE CASCADE;

ALTER TABLE ONLY core.entity_link
    ADD CONSTRAINT entity_link_target_id_fkey FOREIGN KEY (target_id) REFERENCES core.entity(id) ON DELETE CASCADE;

ALTER TABLE ONLY core.entity_link
    ADD CONSTRAINT entity_link_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES core.workspace(id) ON DELETE CASCADE;

ALTER TABLE ONLY core.entity
    ADD CONSTRAINT entity_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES core.workspace(id) ON DELETE CASCADE;

ALTER TABLE ONLY core.event_log
    ADD CONSTRAINT event_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES core."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY core.event_log
    ADD CONSTRAINT event_log_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES core.workspace(id) ON DELETE CASCADE;

ALTER TABLE ONLY core.file
    ADD CONSTRAINT file_created_by_fkey FOREIGN KEY (created_by) REFERENCES core."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY core.file
    ADD CONSTRAINT file_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES core.folder(id) ON DELETE SET NULL;

ALTER TABLE ONLY core.file
    ADD CONSTRAINT file_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES core.workspace(id) ON DELETE CASCADE;

ALTER TABLE ONLY core.folder
    ADD CONSTRAINT folder_created_by_fkey FOREIGN KEY (created_by) REFERENCES core."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY core.folder
    ADD CONSTRAINT folder_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES core.folder(id) ON DELETE CASCADE;

ALTER TABLE ONLY core.folder
    ADD CONSTRAINT folder_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES core.workspace(id) ON DELETE CASCADE;

ALTER TABLE ONLY core.memory
    ADD CONSTRAINT memory_source_conversation_id_fkey FOREIGN KEY (source_conversation_id) REFERENCES core.conversation(id) ON DELETE SET NULL;

ALTER TABLE ONLY core.memory
    ADD CONSTRAINT memory_source_message_id_fkey FOREIGN KEY (source_message_id) REFERENCES core.message(id) ON DELETE SET NULL;

ALTER TABLE ONLY core.memory
    ADD CONSTRAINT memory_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES core.workspace(id) ON DELETE CASCADE;

ALTER TABLE ONLY core.message
    ADD CONSTRAINT message_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES core.conversation(id) ON DELETE CASCADE;

ALTER TABLE ONLY core.task
    ADD CONSTRAINT task_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES core."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY core.task
    ADD CONSTRAINT task_created_by_fkey FOREIGN KEY (created_by) REFERENCES core."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY core.task
    ADD CONSTRAINT task_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES core.task(id) ON DELETE CASCADE;

ALTER TABLE ONLY core.task
    ADD CONSTRAINT task_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES core.workspace(id) ON DELETE CASCADE;

ALTER TABLE ONLY core.tool_call
    ADD CONSTRAINT tool_call_message_id_fkey FOREIGN KEY (message_id) REFERENCES core.message(id) ON DELETE CASCADE;

ALTER TABLE ONLY core.user_setting
    ADD CONSTRAINT user_setting_user_id_fkey FOREIGN KEY (user_id) REFERENCES core."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY core.membership
    ADD CONSTRAINT workspace_member_user_id_fkey FOREIGN KEY (user_id) REFERENCES core."user"(id) ON DELETE CASCADE;

ALTER TABLE ONLY core.membership
    ADD CONSTRAINT workspace_member_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES core.workspace(id) ON DELETE CASCADE;

ALTER TABLE ONLY core.workspace
    ADD CONSTRAINT workspace_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES core."user"(id) ON DELETE SET NULL;

ALTER TABLE ONLY core.workspace_setting
    ADD CONSTRAINT workspace_setting_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES core.workspace(id) ON DELETE CASCADE;

ALTER TABLE content.digest ENABLE ROW LEVEL SECURITY;
CREATE POLICY digest_workspace_access ON content.digest USING ((EXISTS ( SELECT 1
   FROM core.membership m
  WHERE ((m.workspace_id = digest.workspace_id) AND (m.user_id = core.current_user_id()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM core.membership m
  WHERE ((m.workspace_id = digest.workspace_id) AND (m.user_id = core.current_user_id())))));

CREATE POLICY digests_delete_member ON content.digest FOR DELETE USING (core.is_workspace_member(workspace_id));

CREATE POLICY digests_insert_member ON content.digest FOR INSERT WITH CHECK ((core.is_workspace_member(workspace_id) AND (created_by = core.current_user_id())));

CREATE POLICY digests_select_member ON content.digest FOR SELECT USING (core.is_workspace_member(workspace_id));

CREATE POLICY digests_update_member ON content.digest FOR UPDATE USING (core.is_workspace_member(workspace_id)) WITH CHECK (core.is_workspace_member(workspace_id));

CREATE POLICY news_delete_member ON content.news_item FOR DELETE USING (core.is_workspace_member(workspace_id));

CREATE POLICY news_insert_member ON content.news_item FOR INSERT WITH CHECK ((core.is_workspace_member(workspace_id) AND (created_by = core.current_user_id())));

ALTER TABLE content.news_item ENABLE ROW LEVEL SECURITY;
CREATE POLICY news_item_workspace_access ON content.news_item USING ((EXISTS ( SELECT 1
   FROM core.membership m
  WHERE ((m.workspace_id = news_item.workspace_id) AND (m.user_id = core.current_user_id()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM core.membership m
  WHERE ((m.workspace_id = news_item.workspace_id) AND (m.user_id = core.current_user_id())))));

CREATE POLICY news_select_member ON content.news_item FOR SELECT USING (core.is_workspace_member(workspace_id));

ALTER TABLE content.news_source ENABLE ROW LEVEL SECURITY;
CREATE POLICY news_source_delete_member ON content.news_source FOR DELETE USING (core.is_workspace_member(workspace_id));

CREATE POLICY news_source_insert_member ON content.news_source FOR INSERT WITH CHECK ((core.is_workspace_member(workspace_id) AND (created_by = core.current_user_id())));

CREATE POLICY news_source_select_member ON content.news_source FOR SELECT USING (core.is_workspace_member(workspace_id));

ALTER TABLE content.news_source_tab ENABLE ROW LEVEL SECURITY;
CREATE POLICY news_source_tab_delete ON content.news_source_tab FOR DELETE USING ((EXISTS ( SELECT 1
   FROM content.news_source s
  WHERE ((s.id = news_source_tab.source_id) AND core.is_workspace_member(s.workspace_id)))));

CREATE POLICY news_source_tab_insert ON content.news_source_tab FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM content.news_source s
  WHERE ((s.id = news_source_tab.source_id) AND core.is_workspace_member(s.workspace_id)))));

CREATE POLICY news_source_tab_select ON content.news_source_tab FOR SELECT USING ((EXISTS ( SELECT 1
   FROM content.news_source s
  WHERE ((s.id = news_source_tab.source_id) AND core.is_workspace_member(s.workspace_id)))));

CREATE POLICY news_source_update_member ON content.news_source FOR UPDATE USING (core.is_workspace_member(workspace_id)) WITH CHECK (core.is_workspace_member(workspace_id));

ALTER TABLE content.news_tab ENABLE ROW LEVEL SECURITY;
CREATE POLICY news_tab_delete_member ON content.news_tab FOR DELETE USING (core.is_workspace_member(workspace_id));

CREATE POLICY news_tab_insert_member ON content.news_tab FOR INSERT WITH CHECK ((core.is_workspace_member(workspace_id) AND (created_by = core.current_user_id())));

CREATE POLICY news_tab_select_member ON content.news_tab FOR SELECT USING (core.is_workspace_member(workspace_id));

CREATE POLICY news_tab_update_member ON content.news_tab FOR UPDATE USING (core.is_workspace_member(workspace_id)) WITH CHECK (core.is_workspace_member(workspace_id));

CREATE POLICY news_update_member ON content.news_item FOR UPDATE USING (core.is_workspace_member(workspace_id)) WITH CHECK (core.is_workspace_member(workspace_id));

ALTER TABLE core.artifact ENABLE ROW LEVEL SECURITY;
CREATE POLICY artifact_insert_owner ON core.artifact FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM core.conversation c
  WHERE ((c.id = artifact.conversation_id) AND (c.user_id = core.current_user_id())))));

CREATE POLICY artifact_select_owner ON core.artifact FOR SELECT USING ((EXISTS ( SELECT 1
   FROM core.conversation c
  WHERE ((c.id = artifact.conversation_id) AND (c.user_id = core.current_user_id())))));

ALTER TABLE core.conversation ENABLE ROW LEVEL SECURITY;
CREATE POLICY conversation_delete_owner ON core.conversation FOR DELETE USING ((user_id = core.current_user_id()));

CREATE POLICY conversation_insert_owner ON core.conversation FOR INSERT WITH CHECK ((user_id = core.current_user_id()));

CREATE POLICY conversation_select_owner ON core.conversation FOR SELECT USING ((user_id = core.current_user_id()));

CREATE POLICY conversation_update_owner ON core.conversation FOR UPDATE USING ((user_id = core.current_user_id())) WITH CHECK ((user_id = core.current_user_id()));

ALTER TABLE core.entity ENABLE ROW LEVEL SECURITY;
CREATE POLICY entity_delete_member ON core.entity FOR DELETE USING (core.is_workspace_member(workspace_id));

CREATE POLICY entity_insert_member ON core.entity FOR INSERT WITH CHECK ((core.is_workspace_member(workspace_id) AND (created_by = core.current_user_id())));

ALTER TABLE core.entity_link ENABLE ROW LEVEL SECURITY;
CREATE POLICY entity_link_delete_member ON core.entity_link FOR DELETE USING (core.is_workspace_member(workspace_id));

CREATE POLICY entity_link_insert_member ON core.entity_link FOR INSERT WITH CHECK ((core.is_workspace_member(workspace_id) AND (created_by = core.current_user_id())));

CREATE POLICY entity_link_select_member ON core.entity_link FOR SELECT USING (core.is_workspace_member(workspace_id));

CREATE POLICY entity_select_member ON core.entity FOR SELECT USING (core.is_workspace_member(workspace_id));

CREATE POLICY entity_update_member ON core.entity FOR UPDATE USING (core.is_workspace_member(workspace_id)) WITH CHECK (core.is_workspace_member(workspace_id));

ALTER TABLE core.event_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_log_insert_member ON core.event_log FOR INSERT WITH CHECK ((core.is_workspace_member(workspace_id) AND (user_id = core.current_user_id())));

CREATE POLICY event_log_select_member ON core.event_log FOR SELECT USING (core.is_workspace_member(workspace_id));

ALTER TABLE core.file ENABLE ROW LEVEL SECURITY;
CREATE POLICY file_delete_member ON core.file FOR DELETE USING (core.is_workspace_member(workspace_id));

CREATE POLICY file_insert_member ON core.file FOR INSERT WITH CHECK ((core.is_workspace_member(workspace_id) AND (created_by = core.current_user_id())));

CREATE POLICY file_select_member ON core.file FOR SELECT USING (core.is_workspace_member(workspace_id));

CREATE POLICY file_update_member ON core.file FOR UPDATE USING (core.is_workspace_member(workspace_id)) WITH CHECK (core.is_workspace_member(workspace_id));

ALTER TABLE core.folder ENABLE ROW LEVEL SECURITY;
CREATE POLICY folder_delete_member ON core.folder FOR DELETE USING (core.is_workspace_member(workspace_id));

CREATE POLICY folder_insert_member ON core.folder FOR INSERT WITH CHECK ((core.is_workspace_member(workspace_id) AND (created_by = core.current_user_id())));

CREATE POLICY folder_select_member ON core.folder FOR SELECT USING (core.is_workspace_member(workspace_id));

CREATE POLICY folder_update_member ON core.folder FOR UPDATE USING (core.is_workspace_member(workspace_id)) WITH CHECK (core.is_workspace_member(workspace_id));

ALTER TABLE core.membership ENABLE ROW LEVEL SECURITY;
CREATE POLICY membership_self_only ON core.membership FOR SELECT USING ((user_id = core.current_user_id()));

CREATE POLICY memberships_select_self ON core.membership FOR SELECT USING ((user_id = core.current_user_id()));

ALTER TABLE core.memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY memory_delete_member ON core.memory FOR DELETE USING (core.is_workspace_member(workspace_id));

CREATE POLICY memory_insert_member ON core.memory FOR INSERT WITH CHECK (core.is_workspace_member(workspace_id));

CREATE POLICY memory_select_member ON core.memory FOR SELECT USING (core.is_workspace_member(workspace_id));

CREATE POLICY memory_update_member ON core.memory FOR UPDATE USING (core.is_workspace_member(workspace_id)) WITH CHECK (core.is_workspace_member(workspace_id));

ALTER TABLE core.message ENABLE ROW LEVEL SECURITY;
CREATE POLICY message_insert_owner ON core.message FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM core.conversation c
  WHERE ((c.id = message.conversation_id) AND (c.user_id = core.current_user_id())))));

CREATE POLICY message_select_owner ON core.message FOR SELECT USING ((EXISTS ( SELECT 1
   FROM core.conversation c
  WHERE ((c.id = message.conversation_id) AND (c.user_id = core.current_user_id())))));

ALTER TABLE core.task ENABLE ROW LEVEL SECURITY;
CREATE POLICY task_delete_member ON core.task FOR DELETE USING (core.is_workspace_member(workspace_id));

CREATE POLICY task_insert_member ON core.task FOR INSERT WITH CHECK ((core.is_workspace_member(workspace_id) AND (created_by = core.current_user_id())));

CREATE POLICY task_select_member ON core.task FOR SELECT USING (core.is_workspace_member(workspace_id));

CREATE POLICY task_update_member ON core.task FOR UPDATE USING (core.is_workspace_member(workspace_id)) WITH CHECK (core.is_workspace_member(workspace_id));

ALTER TABLE core.tool_call ENABLE ROW LEVEL SECURITY;
CREATE POLICY tool_call_insert_owner ON core.tool_call FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (core.message m
     JOIN core.conversation c ON ((c.id = m.conversation_id)))
  WHERE ((m.id = tool_call.message_id) AND (c.user_id = core.current_user_id())))));

CREATE POLICY tool_call_select_owner ON core.tool_call FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (core.message m
     JOIN core.conversation c ON ((c.id = m.conversation_id)))
  WHERE ((m.id = tool_call.message_id) AND (c.user_id = core.current_user_id())))));

CREATE POLICY tool_call_update_owner ON core.tool_call FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM (core.message m
     JOIN core.conversation c ON ((c.id = m.conversation_id)))
  WHERE ((m.id = tool_call.message_id) AND (c.user_id = core.current_user_id())))));

ALTER TABLE core.user_setting ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_setting_delete_self ON core.user_setting FOR DELETE USING ((user_id = core.current_user_id()));

CREATE POLICY user_setting_insert_self ON core.user_setting FOR INSERT WITH CHECK ((user_id = core.current_user_id()));

CREATE POLICY user_setting_select_self ON core.user_setting FOR SELECT USING ((user_id = core.current_user_id()));

CREATE POLICY user_setting_update_self ON core.user_setting FOR UPDATE USING ((user_id = core.current_user_id())) WITH CHECK ((user_id = core.current_user_id()));

ALTER TABLE core.workspace ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_member_access ON core.workspace FOR SELECT USING ((EXISTS ( SELECT 1
   FROM core.membership m
  WHERE ((m.workspace_id = workspace.id) AND (m.user_id = core.current_user_id())))));

ALTER TABLE core.workspace_setting ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_setting_delete_member ON core.workspace_setting FOR DELETE USING (core.is_workspace_member(workspace_id));

CREATE POLICY workspace_setting_insert_member ON core.workspace_setting FOR INSERT WITH CHECK (core.is_workspace_member(workspace_id));

CREATE POLICY workspace_setting_select_member ON core.workspace_setting FOR SELECT USING (core.is_workspace_member(workspace_id));

CREATE POLICY workspace_setting_update_member ON core.workspace_setting FOR UPDATE USING (core.is_workspace_member(workspace_id)) WITH CHECK (core.is_workspace_member(workspace_id));

CREATE POLICY workspaces_select_member ON core.workspace FOR SELECT USING (core.is_workspace_member(id));

-- Mark all migrations as applied (so migrate.mjs won't re-run them)
INSERT INTO core._migrations (id) VALUES
  ('001_init.sql'),
  ('002_data_contracts.sql'),
  ('003_ai_schema.sql'),
  ('004_tasks_schema.sql'),
  ('005_news_sources.sql'),
  ('006_news_image.sql'),
  ('007_news_perf_indexes.sql')
ON CONFLICT DO NOTHING;

COMMIT;
