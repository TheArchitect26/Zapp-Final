
-- 1. Withdrawal requests table
CREATE TABLE public.withdrawal_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  fee_amount numeric NOT NULL DEFAULT 0,
  net_amount numeric NOT NULL DEFAULT 0,
  payout_method_id uuid,
  status text NOT NULL DEFAULT 'pending',
  provider_reference text,
  admin_notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own withdrawals" ON public.withdrawal_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage withdrawals" ON public.withdrawal_requests FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Payout methods table
CREATE TABLE public.payout_methods (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'bank',
  label text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  is_default boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.payout_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own payout methods" ON public.payout_methods FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own payout methods" ON public.payout_methods FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own payout methods" ON public.payout_methods FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own payout methods" ON public.payout_methods FOR DELETE USING (auth.uid() = user_id);

-- 3. Fee config table
CREATE TABLE public.fee_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fee_type text NOT NULL,
  product_type text,
  fixed_fee numeric NOT NULL DEFAULT 0,
  percentage_fee numeric NOT NULL DEFAULT 0,
  min_fee numeric NOT NULL DEFAULT 0,
  max_fee numeric NOT NULL DEFAULT 0,
  description text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.fee_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active fees" ON public.fee_config FOR SELECT USING (status = 'active');
CREATE POLICY "Admins can manage fees" ON public.fee_config FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Triggers for updated_at
CREATE TRIGGER update_withdrawal_requests_updated_at BEFORE UPDATE ON public.withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_payout_methods_updated_at BEFORE UPDATE ON public.payout_methods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_fee_config_updated_at BEFORE UPDATE ON public.fee_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Update handle_new_wallet to R0
CREATE OR REPLACE FUNCTION public.handle_new_wallet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.wallets (user_id, balance) VALUES (NEW.id, 0);
  RETURN NEW;
END;
$$;

-- 5. Process withdrawal RPC
CREATE OR REPLACE FUNCTION public.process_withdrawal(
  p_amount numeric,
  p_payout_method_id uuid DEFAULT NULL
)
RETURNS withdrawal_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_wallet public.wallets;
  v_fee_pct numeric := 4;
  v_min_fee numeric := 2;
  v_max_fee numeric := 15;
  v_fee numeric;
  v_net numeric;
  v_new_balance numeric;
  v_request public.withdrawal_requests;
  v_fee_config public.fee_config;
BEGIN
  IF p_amount < 20 THEN RAISE EXCEPTION 'Minimum withdrawal is R20'; END IF;

  -- Get fee config if available
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

  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = auth.uid() FOR UPDATE;
  IF v_wallet IS NULL OR v_wallet.balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  v_new_balance := v_wallet.balance - p_amount;
  UPDATE public.wallets SET balance = v_new_balance WHERE user_id = auth.uid();

  INSERT INTO public.wallet_ledger (user_id, amount, type, reference, balance_after)
  VALUES (auth.uid(), -p_amount, 'debit', 'Withdrawal request', v_new_balance);

  INSERT INTO public.transactions (user_id, type, description, amount, status, meta)
  VALUES (auth.uid(), 'withdrawal', 'Withdrawal - R' || v_net || ' (Fee: R' || v_fee || ')', -p_amount, 'pending',
    jsonb_build_object('fee', v_fee, 'net', v_net, 'payout_method_id', p_payout_method_id::text));

  INSERT INTO public.withdrawal_requests (user_id, amount, fee_amount, net_amount, payout_method_id, status)
  VALUES (auth.uid(), p_amount, v_fee, v_net, p_payout_method_id, 'pending')
  RETURNING * INTO v_request;

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (auth.uid(), 'Withdrawal Requested', 'R' || v_net || ' withdrawal submitted (Fee: R' || v_fee || ')', 'withdrawal');

  RETURN v_request;
END;
$$;
