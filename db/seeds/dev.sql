-- Seed: dev
-- Creates default workspaces (ag/german/shared) and memberships.

BEGIN;

-- Users must already exist in core.user.
-- Change usernames here if needed.
DO $$
DECLARE
  ag_username text := 'ag1';
  german_username text := 'german1';
  ag_id uuid;
  german_id uuid;
  ag_ws uuid;
  german_ws uuid;
  shared_ws uuid;
BEGIN
  SELECT id INTO ag_id FROM core."user" WHERE username = ag_username;
  SELECT id INTO german_id FROM core."user" WHERE username = german_username;
  IF ag_id IS NULL THEN RAISE EXCEPTION 'Seed error: missing user %', ag_username; END IF;
  IF german_id IS NULL THEN RAISE EXCEPTION 'Seed error: missing user %', german_username; END IF;

  INSERT INTO core.workspace (slug, name, kind, owner_user_id)
  VALUES ('ag', 'AG', 'personal', ag_id)
  ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name, kind=EXCLUDED.kind, owner_user_id=EXCLUDED.owner_user_id
  RETURNING id INTO ag_ws;

  INSERT INTO core.workspace (slug, name, kind, owner_user_id)
  VALUES ('german', 'German', 'personal', german_id)
  ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name, kind=EXCLUDED.kind, owner_user_id=EXCLUDED.owner_user_id
  RETURNING id INTO german_ws;

  INSERT INTO core.workspace (slug, name, kind, owner_user_id)
  VALUES ('shared', 'Shared', 'shared', NULL)
  ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name, kind=EXCLUDED.kind, owner_user_id=EXCLUDED.owner_user_id
  RETURNING id INTO shared_ws;

  INSERT INTO core.membership (workspace_id, user_id, role)
  VALUES (ag_ws, ag_id, 'owner')
  ON CONFLICT (workspace_id, user_id) DO UPDATE SET role=EXCLUDED.role;

  INSERT INTO core.membership (workspace_id, user_id, role)
  VALUES (shared_ws, ag_id, 'owner')
  ON CONFLICT (workspace_id, user_id) DO UPDATE SET role=EXCLUDED.role;

  INSERT INTO core.membership (workspace_id, user_id, role)
  VALUES (german_ws, german_id, 'owner')
  ON CONFLICT (workspace_id, user_id) DO UPDATE SET role=EXCLUDED.role;

  INSERT INTO core.membership (workspace_id, user_id, role)
  VALUES (shared_ws, german_id, 'member')
  ON CONFLICT (workspace_id, user_id) DO UPDATE SET role=EXCLUDED.role;
END $$;

COMMIT;
