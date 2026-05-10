CREATE TABLE IF NOT EXISTS public.topup_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  amount numeric NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'ZAR',
  merchant_transaction_id text UNIQUE NOT NULL,
  peach_checkout_id text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','completed','failed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.topup_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own topups" ON public.topup_requests
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins see all topups" ON public.topup_requests
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Re-enable top_up_wallet with p_user_id so service-role calls work
CREATE OR REPLACE FUNCTION public.top_up_wallet(
  p_amount NUMERIC,
  p_user_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID;
  v_new_balance NUMERIC;
BEGIN
  v_caller := COALESCE(p_user_id, auth.uid());
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHENTICATED');
  END IF;
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_AMOUNT');
  END IF;

  UPDATE public.wallets SET balance = balance + p_amount WHERE user_id = v_caller
  RETURNING balance INTO v_new_balance;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'WALLET_NOT_FOUND');
  END IF;

  INSERT INTO public.wallet_ledger (user_id, amount, type, reference, balance_after)
  VALUES (v_caller, p_amount, 'credit', 'Top-up via payment gateway', v_new_balance);

  INSERT INTO public.transactions (user_id, type, description, amount, status)
  VALUES (v_caller, 'topup', 'Wallet top-up', p_amount, 'completed');

  RETURN jsonb_build_object('success', true, 'balance', v_new_balance);
END;
$$;

-- Add columns needed by the updated topup controller
ALTER TABLE public.topup_requests
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'peach';

CREATE UNIQUE INDEX IF NOT EXISTS idx_topup_requests_idempotency
  ON public.topup_requests (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
