CREATE TABLE IF NOT EXISTS public.ml_training_data (
  id BIGSERIAL PRIMARY KEY,
  features JSONB NOT NULL,
  label INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ml_models (
  id BIGSERIAL PRIMARY KEY,
  version TEXT NOT NULL,
  path TEXT NOT NULL,
  accuracy DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ml_training_data_created_at
  ON public.ml_training_data(created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ml_models_version
  ON public.ml_models(version);
