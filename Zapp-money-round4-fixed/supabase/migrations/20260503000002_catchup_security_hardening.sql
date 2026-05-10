-- Catch-up: apply the parts of 20260503000000 that failed on the remote
-- (wallet_ledger existed without currency column; settlement_queue/dlq/fraud tables missing)

-- Tables that didn't exist yet
CREATE TABLE IF NOT EXISTS settlement_queue (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id TEXT NOT NULL,
  from_account   TEXT,
  to_account     TEXT,
  amount         NUMERIC NOT NULL,
  currency       TEXT NOT NULL DEFAULT 'ZAR',
  status         TEXT NOT NULL DEFAULT 'PENDING',
  retry_count    INT NOT NULL DEFAULT 0,
  last_error     TEXT,
  risk_metadata  JSONB DEFAULT '{}'::jsonb,
  locked_by      TEXT,
  locked_at      TIMESTAMP,
  available_at   TIMESTAMP DEFAULT NOW(),
  processed_at   TIMESTAMP,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_settlement_queue_tx_unique
  ON settlement_queue (transaction_id);

CREATE INDEX IF NOT EXISTS idx_settlement_queue_pick
  ON settlement_queue (status, available_at, created_at);

CREATE TABLE IF NOT EXISTS settlement_dlq (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id TEXT NOT NULL,
  error          TEXT,
  payload        JSONB DEFAULT '{}'::jsonb,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fraud_memory (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id  TEXT NOT NULL,
  risk_score FLOAT NOT NULL,
  outcome    TEXT,
  amount     NUMERIC,
  velocity   NUMERIC,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fraud_memory_entity
  ON fraud_memory (entity_id, created_at DESC);

CREATE TABLE IF NOT EXISTS fraud_events (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id        TEXT NOT NULL,
  amount             NUMERIC NOT NULL,
  velocity           NUMERIC DEFAULT 1,
  device_fingerprint TEXT,
  risk_score         FLOAT NOT NULL,
  is_fraud           BOOLEAN NOT NULL DEFAULT false,
  created_at         TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fraud_events_customer
  ON fraud_events (customer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS governance_state (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key            TEXT PRIMARY KEY,
  transaction_id TEXT,
  user_id        UUID,
  response       JSONB,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE,
  metadata   JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add currency column to wallet_ledger if missing
ALTER TABLE wallet_ledger ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'ZAR';
ALTER TABLE wallet_ledger ADD COLUMN IF NOT EXISTS entry_type TEXT CHECK (entry_type IN ('DEBIT','CREDIT'));
ALTER TABLE wallet_ledger ADD COLUMN IF NOT EXISTS transaction_id TEXT;
ALTER TABLE wallet_ledger ADD COLUMN IF NOT EXISTS from_account TEXT;
ALTER TABLE wallet_ledger ADD COLUMN IF NOT EXISTS to_account TEXT;
ALTER TABLE wallet_ledger ADD COLUMN IF NOT EXISTS risk_score FLOAT DEFAULT 0;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_user_currency
  ON wallet_ledger (user_id, currency, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_ledger_tx_id
  ON wallet_ledger (transaction_id);
