CREATE TABLE IF NOT EXISTS public.event_stream_buffer (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_stream_buffer_processed_created_at
  ON public.event_stream_buffer(processed, created_at ASC);
