-- M-1: Add TTL / expiry to idempotency_keys
-- 1. Add user_id column so keys are scoped per-user (prevents cross-user collisions)
-- 2. Add index on created_at for efficient cleanup
-- 3. Schedule pg_cron job to delete rows older than 72 hours

ALTER TABLE idempotency_keys
  ADD COLUMN IF NOT EXISTS user_id TEXT;

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created_at
  ON idempotency_keys (created_at);

-- Scheduled cleanup: delete keys older than 72 hours (requires pg_cron extension)
SELECT cron.schedule(
  'idempotency_keys_cleanup',
  '0 * * * *',  -- every hour
  $$DELETE FROM idempotency_keys WHERE created_at < NOW() - INTERVAL '72 hours'$$
);
