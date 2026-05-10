-- =============================================================
-- Migration: security & schema hardening
-- Fixes:
--   1. Governance state table (replaces in-memory counters)
--   2. Authoritative wallet_ledger + idempotency_keys schema
--   3. Missing performance indexes
--   4. Starter balance → 0 (was R1,250 — fraud vector)
--   5. settlement_queue schema consolidation
--   6. fraud_memory + fraud_events tables
-- =============================================================

-- 1. GOVERNANCE STATE — persisted across server restarts
CREATE TABLE IF NOT EXISTS governance_state (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 2. IDEMPOTENCY KEYS
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key            TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 3. WALLET LEDGER (double-entry audit trail, amounts in cents)
CREATE TABLE IF NOT EXISTS wallet_ledger (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id TEXT,
  type           TEXT,
  amount         BIGINT NOT NULL,
  currency       TEXT NOT NULL DEFAULT 'ZAR',
  from_account   TEXT,
  to_account     TEXT,
  status         TEXT,
  risk_score     FLOAT DEFAULT 0,
  user_id        TEXT,
  entry_type     TEXT CHECK (entry_type IN ('DEBIT','CREDIT')),
  created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 4. SETTLEMENT QUEUE
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

-- 5. SETTLEMENT DLQ
CREATE TABLE IF NOT EXISTS settlement_dlq (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id TEXT NOT NULL,
  error          TEXT,
  payload        JSONB DEFAULT '{}'::jsonb,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 6. FRAUD MEMORY (JS fraud engine history)
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

-- 7. FRAUD EVENTS (Python fraud brain history)
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

-- 8. BRAIN DECISIONS
CREATE TABLE IF NOT EXISTS brain_decisions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id TEXT,
  action         TEXT,
  confidence     FLOAT,
  reason         TEXT,
  mode           TEXT,
  executed       BOOLEAN DEFAULT false,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 9. CUSTOMERS (for customer management routes)
CREATE TABLE IF NOT EXISTS customers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE,
  metadata   JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 10. PERFORMANCE INDEXES on existing tables
CREATE INDEX IF NOT EXISTS idx_transactions_user_created
  ON public.transactions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_ledger_user_currency
  ON wallet_ledger (user_id, currency, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_ledger_tx_id
  ON wallet_ledger (transaction_id);

-- 11. FIX STARTER BALANCE — set to 0 for new accounts
--     Existing migration gave R1,250; replace with 0.
--     Promotional credits should be tracked separately with withdrawal restrictions.
CREATE OR REPLACE FUNCTION public.handle_new_wallet()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.wallets (user_id, balance) VALUES (NEW.id, 0.00);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
