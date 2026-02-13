-- 0004_auth_telegram.sql
-- Adds Telegram-based 2FA/recovery primitives.

BEGIN;

ALTER TABLE core."user"
  ADD COLUMN IF NOT EXISTS telegram_user_id bigint,
  ADD COLUMN IF NOT EXISTS password_updated_at timestamptz;

-- One-time challenges for login / recovery.
CREATE TABLE IF NOT EXISTS core.auth_challenge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES core."user"(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('login','recovery')),
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_challenge_user_created_idx
  ON core.auth_challenge (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS auth_challenge_expires_idx
  ON core.auth_challenge (expires_at);

-- Outbox for Telegram messages; Clawdbot cron will deliver.
CREATE TABLE IF NOT EXISTS core.telegram_outbox (
  id bigserial PRIMARY KEY,
  telegram_user_id bigint NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE INDEX IF NOT EXISTS telegram_outbox_unsent_idx
  ON core.telegram_outbox (created_at)
  WHERE sent_at IS NULL;

COMMIT;
