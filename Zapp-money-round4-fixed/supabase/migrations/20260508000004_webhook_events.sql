CREATE TABLE IF NOT EXISTS webhook_events (
  event_id     TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS webhook_events_processed_at_idx ON webhook_events (processed_at);
