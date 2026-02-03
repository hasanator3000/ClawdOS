-- Migration: core/0002_move_public_to_namespaces
-- Schema: core/content
-- Description: Move existing public tables into core/content namespaces and align names
-- Author: AI Agent
-- Date: 2026-02-03
--
-- NOTE: This is a STRUCTURAL migration. Do not run without a backup.

BEGIN;

-- Preconditions: ensure schemas exist (0001)
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS content;

-- Move tables (idempotent-ish): only if they exist in public.
DO $$
BEGIN
  IF to_regclass('public.app_user') IS NOT NULL THEN
    ALTER TABLE public.app_user SET SCHEMA core;
  END IF;
  IF to_regclass('public.workspace') IS NOT NULL THEN
    ALTER TABLE public.workspace SET SCHEMA core;
  END IF;
  IF to_regclass('public.workspace_member') IS NOT NULL THEN
    ALTER TABLE public.workspace_member SET SCHEMA core;
  END IF;
  IF to_regclass('public.digest') IS NOT NULL THEN
    ALTER TABLE public.digest SET SCHEMA content;
  END IF;
  IF to_regclass('public.news_item') IS NOT NULL THEN
    ALTER TABLE public.news_item SET SCHEMA content;
  END IF;
END $$;

-- Rename tables to match constitution (singular, no prefixes)
-- (Skip if already renamed)
DO $$
BEGIN
  IF to_regclass('core.app_user') IS NOT NULL AND to_regclass('core.user') IS NULL THEN
    ALTER TABLE core.app_user RENAME TO "user";
  END IF;
  IF to_regclass('core.workspace_member') IS NOT NULL AND to_regclass('core.membership') IS NULL THEN
    ALTER TABLE core.workspace_member RENAME TO membership;
  END IF;
  -- core.workspace already good name
END $$;

-- Update FK references if needed (Postgres updates schema-qualified refs on move/rename automatically in most cases).
-- Recreate/align RLS policies to reference core.current_user_id() and core.membership
-- NOTE: We drop old policies by name when present.

-- workspace policies
DO $$
BEGIN
  IF to_regclass('core.workspace') IS NOT NULL THEN
    -- Drop legacy policy names if they exist
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='core' AND tablename='workspace' AND policyname='workspace_select') THEN
      EXECUTE 'DROP POLICY workspace_select ON core.workspace';
    END IF;

    EXECUTE $$
      CREATE POLICY workspace_member_access ON core.workspace
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM core.membership m
          WHERE m.workspace_id = core.workspace.id
            AND m.user_id = core.current_user_id()
        )
      )
    $$;
  END IF;
END $$;

-- membership policies
DO $$
BEGIN
  IF to_regclass('core.membership') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='core' AND tablename='membership' AND policyname='workspace_member_select') THEN
      EXECUTE 'DROP POLICY workspace_member_select ON core.membership';
    END IF;
    EXECUTE $$
      CREATE POLICY membership_self_read ON core.membership
      FOR SELECT
      USING (
        user_id = core.current_user_id()
        OR EXISTS (
          SELECT 1 FROM core.membership m
          WHERE m.workspace_id = core.membership.workspace_id
            AND m.user_id = core.current_user_id()
        )
      )
    $$;
  END IF;
END $$;

-- digest/news policies
DO $$
BEGIN
  IF to_regclass('content.digest') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='content' AND tablename='digest' AND policyname='digest_rw') THEN
      EXECUTE 'DROP POLICY digest_rw ON content.digest';
    END IF;
    EXECUTE $$
      CREATE POLICY digest_workspace_access ON content.digest
      FOR ALL
      USING (EXISTS (SELECT 1 FROM core.membership m WHERE m.workspace_id = content.digest.workspace_id AND m.user_id = core.current_user_id()))
      WITH CHECK (EXISTS (SELECT 1 FROM core.membership m WHERE m.workspace_id = content.digest.workspace_id AND m.user_id = core.current_user_id()))
    $$;
  END IF;

  IF to_regclass('content.news_item') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='content' AND tablename='news_item' AND policyname='news_item_rw') THEN
      EXECUTE 'DROP POLICY news_item_rw ON content.news_item';
    END IF;
    EXECUTE $$
      CREATE POLICY news_item_workspace_access ON content.news_item
      FOR ALL
      USING (EXISTS (SELECT 1 FROM core.membership m WHERE m.workspace_id = content.news_item.workspace_id AND m.user_id = core.current_user_id()))
      WITH CHECK (EXISTS (SELECT 1 FROM core.membership m WHERE m.workspace_id = content.news_item.workspace_id AND m.user_id = core.current_user_id()))
    $$;
  END IF;
END $$;

-- Ensure RLS enabled (idempotent)
ALTER TABLE IF EXISTS core.workspace ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS core.membership ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS content.digest ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS content.news_item ENABLE ROW LEVEL SECURITY;

-- Compatibility views in public so the app can keep using unqualified table names for now.
-- (These are TEMPORARY until the code is updated to core./content.)
CREATE OR REPLACE VIEW public.app_user AS SELECT * FROM core."user";
CREATE OR REPLACE VIEW public.workspace AS SELECT * FROM core.workspace;
CREATE OR REPLACE VIEW public.workspace_member AS SELECT * FROM core.membership;
CREATE OR REPLACE VIEW public.digest AS SELECT * FROM content.digest;
CREATE OR REPLACE VIEW public.news_item AS SELECT * FROM content.news_item;

-- Grants for app role
GRANT USAGE ON SCHEMA core, content TO lifeos;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA core TO lifeos;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA content TO lifeos;
ALTER DEFAULT PRIVILEGES IN SCHEMA core GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO lifeos;
ALTER DEFAULT PRIVILEGES IN SCHEMA content GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO lifeos;

INSERT INTO core.schema_migration(schema_name, version, description)
VALUES ('core', 2, 'Move public tables to core/content namespaces and rebind RLS; add compatibility views')
ON CONFLICT (schema_name, version) DO NOTHING;

COMMIT;

-- DOWN (manual)
-- NOTE: moving back + renames is risky; do only if necessary.
