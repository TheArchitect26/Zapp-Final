-- Fix: transfer_funds called via service-role key has auth.uid() = NULL.
-- Add optional p_sender_id so the caller can supply the sender explicitly.
CREATE OR REPLACE FUNCTION public.transfer_funds(
  p_recipient_username TEXT,
  p_amount NUMERIC,
  p_message TEXT DEFAULT '',
  p_sender_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_sender_wallet public.wallets;
  v_recipient_profile public.profiles;
  v_sender_new_balance NUMERIC;
  v_recipient_new_balance NUMERIC;
  v_sender_username TEXT;
BEGIN
  v_caller_id := COALESCE(p_sender_id, auth.uid());
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHENTICATED');
  END IF;

  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_AMOUNT');
  END IF;

  SELECT * INTO v_recipient_profile FROM public.profiles WHERE username = p_recipient_username;
  IF v_recipient_profile IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'RECIPIENT_NOT_FOUND');
  END IF;
  IF v_recipient_profile.user_id = v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'SELF_TRANSFER');
  END IF;

  SELECT * INTO v_sender_wallet FROM public.wallets WHERE user_id = v_caller_id FOR UPDATE;
  IF v_sender_wallet IS NULL OR v_sender_wallet.balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'INSUFFICIENT_BALANCE');
  END IF;

  SELECT username INTO v_sender_username FROM public.profiles WHERE user_id = v_caller_id;

  v_sender_new_balance := v_sender_wallet.balance - p_amount;
  UPDATE public.wallets SET balance = v_sender_new_balance WHERE user_id = v_caller_id;

  SELECT balance + p_amount INTO v_recipient_new_balance
    FROM public.wallets WHERE user_id = v_recipient_profile.user_id;
  UPDATE public.wallets SET balance = balance + p_amount
    WHERE user_id = v_recipient_profile.user_id;

  INSERT INTO public.wallet_ledger (user_id, amount, type, reference, balance_after)
  VALUES (v_caller_id, -p_amount, 'debit',
          'Transfer to @' || p_recipient_username, v_sender_new_balance);

  INSERT INTO public.wallet_ledger (user_id, amount, type, reference, balance_after)
  VALUES (v_recipient_profile.user_id, p_amount, 'credit',
          'Transfer from @' || v_sender_username, v_recipient_new_balance);

  INSERT INTO public.transactions (user_id, type, description, amount, status, meta)
  VALUES (v_caller_id, 'transfer', 'Sent to @' || p_recipient_username, -p_amount, 'completed',
          jsonb_build_object('recipient', p_recipient_username, 'message', p_message));

  INSERT INTO public.transactions (user_id, type, description, amount, status, meta)
  VALUES (v_recipient_profile.user_id, 'transfer',
          'Received from @' || v_sender_username, p_amount, 'completed',
          jsonb_build_object('sender', v_sender_username, 'message', p_message));

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (v_caller_id, 'Money Sent',
          'R' || p_amount || ' sent to @' || p_recipient_username, 'transfer');
  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (v_recipient_profile.user_id, 'Money Received',
          'R' || p_amount || ' from @' || v_sender_username, 'transfer');

  RETURN jsonb_build_object('success', true, 'amount', p_amount,
                             'recipient', p_recipient_username);
END;
$$;
