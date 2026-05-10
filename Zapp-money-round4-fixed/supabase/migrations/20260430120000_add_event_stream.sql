CREATE TABLE IF NOT EXISTS public.event_stream (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  transaction_id TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_event_stream_type_created_at
  ON public.event_stream(type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_stream_transaction_id
  ON public.event_stream(transaction_id);
