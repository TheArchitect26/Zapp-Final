
-- Earn opportunities (provider-agnostic earning tasks)
CREATE TABLE public.earn_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'internal',
  category text NOT NULL DEFAULT 'survey',
  title text NOT NULL,
  description text,
  coin_reward numeric NOT NULL DEFAULT 0,
  estimated_fiat_value numeric GENERATED ALWAYS AS (coin_reward / 100.0) STORED,
  estimated_minutes integer NOT NULL DEFAULT 5,
  status text NOT NULL DEFAULT 'active',
  availability_type text NOT NULL DEFAULT 'unlimited',
  max_completions integer,
  cooldown_hours integer,
  external_reference_id text,
  provider_config jsonb DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.earn_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active earn opportunities" ON public.earn_opportunities
  FOR SELECT TO public USING (status = 'active');

CREATE POLICY "Admins can manage earn opportunities" ON public.earn_opportunities
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Earn completions
CREATE TABLE public.earn_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  opportunity_id uuid NOT NULL REFERENCES public.earn_opportunities(id),
  status text NOT NULL DEFAULT 'completed',
  coin_reward numeric NOT NULL DEFAULT 0,
  provider_reference text,
  completed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.earn_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own earn completions" ON public.earn_completions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own earn completions" ON public.earn_completions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Currencies
CREATE TABLE public.currencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  symbol text NOT NULL DEFAULT '',
  country text,
  zc_rate numeric NOT NULL DEFAULT 100,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active currencies" ON public.currencies
  FOR SELECT TO public USING (status = 'active');

CREATE POLICY "Admins can manage currencies" ON public.currencies
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Transfer corridors
CREATE TABLE public.transfer_corridors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_currency_id uuid NOT NULL REFERENCES public.currencies(id),
  destination_currency_id uuid NOT NULL REFERENCES public.currencies(id),
  fee_percentage numeric NOT NULL DEFAULT 2.5,
  flat_fee numeric NOT NULL DEFAULT 0,
  min_amount numeric NOT NULL DEFAULT 10,
  max_amount numeric NOT NULL DEFAULT 50000,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.transfer_corridors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active corridors" ON public.transfer_corridors
  FOR SELECT TO public USING (status = 'active');

CREATE POLICY "Admins can manage corridors" ON public.transfer_corridors
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

-- International transfers
CREATE TABLE public.international_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  recipient_identifier text NOT NULL,
  corridor_id uuid REFERENCES public.transfer_corridors(id),
  source_amount numeric NOT NULL,
  source_currency text NOT NULL DEFAULT 'ZAR',
  zc_bridge_amount numeric NOT NULL,
  destination_amount numeric NOT NULL,
  destination_currency text NOT NULL,
  fee_amount numeric NOT NULL DEFAULT 0,
  exchange_rate numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reference text,
  provider_reference text,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.international_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own international transfers" ON public.international_transfers
  FOR SELECT TO authenticated USING (auth.uid() = sender_id);

-- Payment requests (gateway architecture)
CREATE TABLE public.payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'ZAR',
  type text NOT NULL DEFAULT 'deposit',
  status text NOT NULL DEFAULT 'pending',
  provider text,
  provider_reference text,
  callback_data jsonb DEFAULT '{}'::jsonb,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payment requests" ON public.payment_requests
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own payment requests" ON public.payment_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Indexes for performance at scale
CREATE INDEX idx_wallet_ledger_user_created ON public.wallet_ledger (user_id, created_at DESC);
CREATE INDEX idx_transactions_user_created ON public.transactions (user_id, created_at DESC);
CREATE INDEX idx_notifications_user_read ON public.notifications (user_id, read, created_at DESC);
CREATE INDEX idx_earn_completions_user ON public.earn_completions (user_id, completed_at DESC);
CREATE INDEX idx_earn_opportunities_status ON public.earn_opportunities (status, category);
CREATE INDEX idx_international_transfers_sender ON public.international_transfers (sender_id, created_at DESC);
CREATE INDEX idx_payment_requests_user ON public.payment_requests (user_id, created_at DESC);

-- Enable realtime on key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.wallets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.coin_wallets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;

-- Complete earn opportunity RPC
CREATE OR REPLACE FUNCTION public.complete_earn_opportunity(p_opportunity_id uuid)
RETURNS earn_completions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_opp public.earn_opportunities;
  v_completion public.earn_completions;
  v_existing int;
BEGIN
  SELECT * INTO v_opp FROM public.earn_opportunities WHERE id = p_opportunity_id AND status = 'active';
  IF v_opp IS NULL THEN RAISE EXCEPTION 'Opportunity not found or inactive'; END IF;

  IF v_opp.availability_type = 'once' THEN
    SELECT count(*) INTO v_existing FROM public.earn_completions
    WHERE user_id = auth.uid() AND opportunity_id = p_opportunity_id;
    IF v_existing > 0 THEN RAISE EXCEPTION 'Already completed'; END IF;
  END IF;

  IF v_opp.cooldown_hours IS NOT NULL THEN
    SELECT count(*) INTO v_existing FROM public.earn_completions
    WHERE user_id = auth.uid() AND opportunity_id = p_opportunity_id
    AND completed_at > now() - (v_opp.cooldown_hours || ' hours')::interval;
    IF v_existing > 0 THEN RAISE EXCEPTION 'Cooldown active'; END IF;
  END IF;

  INSERT INTO public.earn_completions (user_id, opportunity_id, coin_reward)
  VALUES (auth.uid(), p_opportunity_id, v_opp.coin_reward)
  RETURNING * INTO v_completion;

  UPDATE public.coin_wallets SET balance = balance + v_opp.coin_reward WHERE user_id = auth.uid();
  UPDATE public.profiles SET coin_balance = coin_balance + v_opp.coin_reward WHERE user_id = auth.uid();

  INSERT INTO public.transactions (user_id, type, description, amount, status, meta)
  VALUES (auth.uid(), 'survey_reward', v_opp.title || ' reward', v_opp.coin_reward, 'completed',
    jsonb_build_object('opportunity_id', p_opportunity_id::text, 'category', v_opp.category, 'coins', v_opp.coin_reward));

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (auth.uid(), 'Reward Earned', 'Earned ' || v_opp.coin_reward || ' ZC from ' || v_opp.title, 'reward');

  RETURN v_completion;
END;
$$;

-- Process international transfer RPC
CREATE OR REPLACE FUNCTION public.process_international_transfer(
  p_recipient text,
  p_source_amount numeric,
  p_destination_currency text,
  p_corridor_id uuid
)
RETURNS international_transfers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_wallet public.wallets;
  v_corridor public.transfer_corridors;
  v_dest_currency public.currencies;
  v_source_currency public.currencies;
  v_fee numeric;
  v_net_amount numeric;
  v_zc_amount numeric;
  v_dest_amount numeric;
  v_exchange_rate numeric;
  v_new_balance numeric;
  v_transfer public.international_transfers;
BEGIN
  IF p_source_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  SELECT * INTO v_corridor FROM public.transfer_corridors WHERE id = p_corridor_id AND status = 'active';
  IF v_corridor IS NULL THEN RAISE EXCEPTION 'Transfer route not available'; END IF;

  IF p_source_amount < v_corridor.min_amount OR p_source_amount > v_corridor.max_amount THEN
    RAISE EXCEPTION 'Amount out of range';
  END IF;

  SELECT * INTO v_source_currency FROM public.currencies WHERE id = v_corridor.source_currency_id;
  SELECT * INTO v_dest_currency FROM public.currencies WHERE id = v_corridor.destination_currency_id AND code = p_destination_currency;
  IF v_dest_currency IS NULL THEN RAISE EXCEPTION 'Destination currency not supported'; END IF;

  v_fee := (p_source_amount * v_corridor.fee_percentage / 100) + v_corridor.flat_fee;
  v_net_amount := p_source_amount - v_fee;
  v_zc_amount := v_net_amount * v_source_currency.zc_rate;
  v_exchange_rate := v_dest_currency.zc_rate;
  v_dest_amount := v_zc_amount / v_exchange_rate;

  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = auth.uid() FOR UPDATE;
  IF v_wallet IS NULL OR v_wallet.balance < p_source_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  v_new_balance := v_wallet.balance - p_source_amount;
  UPDATE public.wallets SET balance = v_new_balance WHERE user_id = auth.uid();

  INSERT INTO public.wallet_ledger (user_id, amount, type, reference, balance_after)
  VALUES (auth.uid(), -p_source_amount, 'debit', 'International transfer to ' || p_recipient, v_new_balance);

  INSERT INTO public.international_transfers (sender_id, recipient_identifier, corridor_id,
    source_amount, source_currency, zc_bridge_amount, destination_amount, destination_currency,
    fee_amount, exchange_rate, status)
  VALUES (auth.uid(), p_recipient, p_corridor_id,
    p_source_amount, v_source_currency.code, v_zc_amount, v_dest_amount, p_destination_currency,
    v_fee, v_exchange_rate, 'completed')
  RETURNING * INTO v_transfer;

  INSERT INTO public.transactions (user_id, type, description, amount, status, meta)
  VALUES (auth.uid(), 'transfer', 'International transfer to ' || p_recipient, -p_source_amount, 'completed',
    jsonb_build_object('type', 'international', 'recipient', p_recipient, 'dest_currency', p_destination_currency, 'dest_amount', v_dest_amount));

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (auth.uid(), 'Transfer Sent', 'Sent ' || v_dest_amount || ' ' || p_destination_currency || ' to ' || p_recipient, 'transfer');

  RETURN v_transfer;
END;
$$;
