CREATE OR REPLACE FUNCTION public.reverse_withdrawal(p_withdrawal_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wr public.withdrawal_requests;
  v_new_balance NUMERIC;
BEGIN
  SELECT * INTO v_wr FROM public.withdrawal_requests WHERE id = p_withdrawal_id FOR UPDATE;
  IF v_wr IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'WITHDRAWAL_NOT_FOUND');
  END IF;
  IF v_wr.status NOT IN ('processing', 'failed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_STATUS');
  END IF;

  UPDATE public.wallets SET balance = balance + v_wr.amount WHERE user_id = v_wr.user_id
  RETURNING balance INTO v_new_balance;

  INSERT INTO public.wallet_ledger (user_id, amount, type, reference, balance_after)
  VALUES (v_wr.user_id, v_wr.amount, 'reversal', 'Withdrawal reversal #' || p_withdrawal_id, v_new_balance);

  UPDATE public.withdrawal_requests SET status = 'reversed', updated_at = now()
  WHERE id = p_withdrawal_id;

  RETURN jsonb_build_object('success', true, 'refunded', v_wr.amount);
END;
$$;
