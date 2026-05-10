-- Fix all 3 production blockers:
--   1. idempotency_keys: add user_id + response columns
--   2. audit_log: create table
--   3. process_withdrawal: add p_sender_id param (service-role key has auth.uid() = NULL)

-- ── 1. idempotency_keys: add missing columns ──────────────────────────────────
ALTER TABLE idempotency_keys
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS response JSONB;

-- ── 2. audit_log table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id         BIGSERIAL PRIMARY KEY,
  type       TEXT NOT NULL,
  user_id    UUID,
  data       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_created
  ON audit_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_type
  ON audit_log (type, created_at DESC);

-- ── 3. process_withdrawal: add p_sender_id so service-role calls work ─────────
CREATE OR REPLACE FUNCTION public.process_withdrawal(
  p_amount           NUMERIC,
  p_payout_method_id UUID    DEFAULT NULL,
  p_sender_id        UUID    DEFAULT NULL
)
RETURNS withdrawal_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller        UUID;
  v_wallet        public.wallets;
  v_fee_pct       NUMERIC := 4;
  v_min_fee       NUMERIC := 2;
  v_max_fee       NUMERIC := 15;
  v_fee           NUMERIC;
  v_net           NUMERIC;
  v_new_balance   NUMERIC;
  v_request       public.withdrawal_requests;
  v_fee_config    public.fee_config;
BEGIN
  -- Accept explicit sender (service-role) or fall back to session user
  v_caller := COALESCE(p_sender_id, auth.uid());
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  IF p_amount < 20 THEN
    RAISE EXCEPTION 'Minimum withdrawal is R20';
  END IF;

  -- Fee config
  SELECT * INTO v_fee_config FROM public.fee_config
    WHERE fee_type = 'withdrawal' AND status = 'active' LIMIT 1;
  IF v_fee_config IS NOT NULL THEN
    v_fee_pct := v_fee_config.percentage_fee;
    v_min_fee := v_fee_config.min_fee;
    v_max_fee := v_fee_config.max_fee;
  END IF;

  v_fee := p_amount * v_fee_pct / 100;
  IF v_fee < v_min_fee THEN v_fee := v_min_fee; END IF;
  IF v_max_fee > 0 AND v_fee > v_max_fee THEN v_fee := v_max_fee; END IF;
  v_net := p_amount - v_fee;

  -- Lock wallet row
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_caller FOR UPDATE;
  IF v_wallet IS NULL OR v_wallet.balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  v_new_balance := v_wallet.balance - p_amount;
  UPDATE public.wallets SET balance = v_new_balance WHERE user_id = v_caller;

  INSERT INTO public.wallet_ledger (user_id, amount, type, reference, balance_after)
  VALUES (v_caller, -p_amount, 'debit', 'Withdrawal request', v_new_balance);

  INSERT INTO public.transactions (user_id, type, description, amount, status, meta)
  VALUES (v_caller, 'withdrawal',
          'Withdrawal - R' || v_net || ' (Fee: R' || v_fee || ')',
          -p_amount, 'pending',
          jsonb_build_object('fee', v_fee, 'net', v_net,
                             'payout_method_id', p_payout_method_id::text));

  INSERT INTO public.withdrawal_requests
    (user_id, amount, fee_amount, net_amount, payout_method_id, status)
  VALUES (v_caller, p_amount, v_fee, v_net, p_payout_method_id, 'pending')
  RETURNING * INTO v_request;

  RETURN v_request;
END;
$$;

-- ── 4. topup_requests columns added in 20260508000000 (table created there) ──
-- (ALTER moved to 20260508000000 to avoid ordering issue)
