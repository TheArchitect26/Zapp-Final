-- Add MoMo columns to topup_requests
ALTER TABLE public.topup_requests
  ADD COLUMN IF NOT EXISTS provider_ref     TEXT,
  ADD COLUMN IF NOT EXISTS provider_txn_id  TEXT;
