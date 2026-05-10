ALTER TABLE settlement_queue
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS available_at TIMESTAMP DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS locked_by TEXT,
  ADD COLUMN IF NOT EXISTS risk_metadata JSONB DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_settlement_queue_transaction_id_unique
  ON settlement_queue (transaction_id);

CREATE INDEX IF NOT EXISTS idx_settlement_queue_pick
  ON settlement_queue (status, available_at, created_at);

CREATE TABLE IF NOT EXISTS settlement_dlq (
  id BIGSERIAL PRIMARY KEY,
  settlement_id BIGINT,
  transaction_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  failure_reason TEXT NOT NULL,
  failed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  retry_count INT NOT NULL DEFAULT 0,
  worker_id TEXT,
  last_status TEXT
);

CREATE INDEX IF NOT EXISTS idx_settlement_dlq_txid
  ON settlement_dlq (transaction_id);
