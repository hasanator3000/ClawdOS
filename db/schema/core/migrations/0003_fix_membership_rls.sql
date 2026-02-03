-- Migration: core/0003_fix_membership_rls
-- Schema: core
-- Description: Fix membership RLS recursion (safe self-read only)
-- Author: AI Agent
-- Date: 2026-02-03

BEGIN;

-- Drop recursive policy
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='core' AND tablename='membership' AND policyname='membership_self_read') THEN
    EXECUTE 'DROP POLICY membership_self_read ON core.membership';
  END IF;
END $$;

-- Create safe policy (no self-joins)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='core' AND tablename='membership' AND policyname='membership_self_only') THEN
    EXECUTE $pol$
      CREATE POLICY membership_self_only ON core.membership
      FOR SELECT
      USING (user_id = core.current_user_id())
    $pol$;
  END IF;
END $$;

INSERT INTO core.schema_migration(schema_name, version, description)
VALUES ('core', 3, 'Fix core.membership RLS recursion; self-only select')
ON CONFLICT (schema_name, version) DO NOTHING;

COMMIT;
