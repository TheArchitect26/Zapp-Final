CREATE TABLE IF NOT EXISTS public.brain_decisions (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brain_decisions_type_created_at
  ON public.brain_decisions(type, created_at DESC);
