CREATE TABLE IF NOT EXISTS partner_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_name TEXT NOT NULL,
  key_hash     TEXT NOT NULL UNIQUE,
  scopes       TEXT[] NOT NULL DEFAULT '{}',
  active       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE partner_keys ENABLE ROW LEVEL SECURITY;
-- Only service role can access — no user-facing RLS policy needed.
