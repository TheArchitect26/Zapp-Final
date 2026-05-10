CREATE TABLE IF NOT EXISTS admin_audit_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id   UUID NOT NULL,
  action     TEXT NOT NULL,
  target_id  TEXT,
  metadata   JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin
  ON admin_audit_log (admin_id, created_at DESC);
