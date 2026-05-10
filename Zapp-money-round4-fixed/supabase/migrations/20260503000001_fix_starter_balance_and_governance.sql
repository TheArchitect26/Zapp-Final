-- =============================================================
-- Migration: Fix R1,250 phantom starter balances + governance
--
-- 1. Zero out R1,250 balances from old handle_new_wallet() that
--    were never backed by a real transaction (fraud vector).
-- 2. Replace handle_new_wallet() — already done in 20260503000000
--    but this ensures any re-run is idempotent.
-- 3. Disable the old top_up_wallet() RPC until a real payment
--    gateway is integrated.
-- =============================================================

-- 1. Zero phantom R1,250 starter balances
--    Only affects wallets that have the exact legacy amount and
--    have never received a real CREDIT entry in the ledger.
DO $$
DECLARE zeroed INT;
BEGIN
  UPDATE public.wallets w
  SET    balance = 0.00
  WHERE  w.balance = 1250.00
    AND  NOT EXISTS (
           SELECT 1
           FROM   wallet_ledger l
           WHERE  l.user_id = w.user_id::TEXT
             AND  l.entry_type = 'CREDIT'
         );
  GET DIAGNOSTICS zeroed = ROW_COUNT;
  RAISE NOTICE 'Zeroed % phantom R1,250 starter balances', zeroed;
END;
$$;

-- 2. Ensure handle_new_wallet sets balance to 0 (idempotent with prior migration)
CREATE OR REPLACE FUNCTION public.handle_new_wallet()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.wallets (user_id, balance)
  VALUES (NEW.id, 0.00)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 3. Disable top_up_wallet until payment gateway is wired in
CREATE OR REPLACE FUNCTION public.top_up_wallet(p_amount NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'TOP_UP_NOT_AVAILABLE: Payment gateway integration required.'
    USING ERRCODE = 'P0001';
END;
$$;
