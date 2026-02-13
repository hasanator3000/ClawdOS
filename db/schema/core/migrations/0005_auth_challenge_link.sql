-- 0005_auth_challenge_link.sql
-- Extend auth_challenge.kind to support telegram linking confirmations.

BEGIN;

-- Drop and recreate the CHECK constraint to include 'link'.
ALTER TABLE core.auth_challenge
  DROP CONSTRAINT IF EXISTS auth_challenge_kind_check;

ALTER TABLE core.auth_challenge
  ADD CONSTRAINT auth_challenge_kind_check CHECK (kind IN ('login','recovery','link'));

COMMIT;
