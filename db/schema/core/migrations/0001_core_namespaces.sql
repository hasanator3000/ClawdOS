-- Migration: core/0001_core_namespaces
-- Schema: core
-- Description: Create core schema + migration log + helper funcs/triggers (no data move)
-- Author: AI Agent
-- Date: 2026-02-03

BEGIN;

-- 1) Schemas
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS content;
CREATE SCHEMA IF NOT EXISTS finance;
CREATE SCHEMA IF NOT EXISTS biz;
CREATE SCHEMA IF NOT EXISTS docs;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS ai;

-- 2) Migration log (local, schema registry)
CREATE TABLE IF NOT EXISTS core.schema_migration (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_name text NOT NULL,
  version integer NOT NULL,
  description text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(schema_name, version)
);

-- 3) Helper functions (placeholders for next migration)
-- In the local auth setup we use app.user_id session variable.
CREATE OR REPLACE FUNCTION core.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('app.user_id', true), '')::uuid;
$$;

-- Keep backward-compat wrapper in public (existing RLS policies reference it today).
CREATE OR REPLACE FUNCTION public.app_current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT core.current_user_id();
$$;

-- 4) updated_at trigger helper (will be used once tables have updated_at)
CREATE OR REPLACE FUNCTION core.trigger_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Record migration application (best-effort; ignores if already there)
INSERT INTO core.schema_migration(schema_name, version, description)
VALUES ('core', 1, 'Create core/* schemas, schema_migration, helper functions')
ON CONFLICT (schema_name, version) DO NOTHING;

COMMIT;

-- DOWN (manual)
-- BEGIN;
-- DELETE FROM core.schema_migration WHERE schema_name='core' AND version=1;
-- DROP FUNCTION IF EXISTS core.trigger_set_updated_at();
-- DROP FUNCTION IF EXISTS public.app_current_user_id();
-- DROP FUNCTION IF EXISTS core.current_user_id();
-- DROP TABLE IF EXISTS core.schema_migration;
-- DROP SCHEMA IF EXISTS ai;
-- DROP SCHEMA IF EXISTS analytics;
-- DROP SCHEMA IF EXISTS docs;
-- DROP SCHEMA IF EXISTS biz;
-- DROP SCHEMA IF EXISTS finance;
-- DROP SCHEMA IF EXISTS content;
-- DROP SCHEMA IF EXISTS core;
-- COMMIT;
