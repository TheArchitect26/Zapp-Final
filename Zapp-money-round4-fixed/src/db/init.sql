CREATE TABLE IF NOT EXISTS wallet_ledger (
  id TEXT PRIMARY KEY,
  transaction_id TEXT,
  type TEXT,
  amount BIGINT NOT NULL,
  currency TEXT NOT NULL,
  from_account TEXT,
  to_account TEXT,
  status TEXT,
  risk_score FLOAT DEFAULT 0,
  user_id TEXT,
  entry_type TEXT CHECK (entry_type IN ('DEBIT','CREDIT')),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settlement_queue (
  id SERIAL PRIMARY KEY,
  transaction_id TEXT UNIQUE,
  from_account TEXT,
  to_account TEXT,
  amount BIGINT,
  currency TEXT,
  status TEXT,
  retry_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP,
  last_error TEXT
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
