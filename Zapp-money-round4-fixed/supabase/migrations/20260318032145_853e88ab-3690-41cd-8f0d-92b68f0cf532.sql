
-- ==============================================
-- 1. APP ROLE ENUM & USER ROLES TABLE
-- ==============================================
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ==============================================
-- 2. NETWORKS TABLE
-- ==============================================
CREATE TABLE public.networks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'airtime',
  color_class TEXT NOT NULL DEFAULT 'bg-foreground/5 text-foreground',
  status TEXT NOT NULL DEFAULT 'active',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.networks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active networks" ON public.networks
  FOR SELECT USING (status = 'active');

CREATE POLICY "Admins can manage networks" ON public.networks
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ==============================================
-- 3. VOUCHER BRANDS TABLE
-- ==============================================
CREATE TABLE public.voucher_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'shopping',
  color_class TEXT NOT NULL DEFAULT 'bg-foreground/5 text-foreground',
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.voucher_brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active voucher brands" ON public.voucher_brands
  FOR SELECT USING (status = 'active');

CREATE POLICY "Admins can manage voucher brands" ON public.voucher_brands
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ==============================================
-- 4. VOUCHER PRODUCTS TABLE
-- ==============================================
CREATE TABLE public.voucher_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES public.voucher_brands(id) ON DELETE CASCADE NOT NULL,
  value NUMERIC NOT NULL,
  price NUMERIC NOT NULL,
  api_reference TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.voucher_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active voucher products" ON public.voucher_products
  FOR SELECT USING (status = 'active');

CREATE POLICY "Admins can manage voucher products" ON public.voucher_products
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ==============================================
-- 5. WALLET LEDGER TABLE (derived balance)
-- ==============================================
CREATE TABLE public.wallet_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  type TEXT NOT NULL,
  reference TEXT,
  balance_after NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ledger" ON public.wallet_ledger
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ==============================================
-- 6. NOTIFICATIONS TABLE
-- ==============================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  read BOOLEAN NOT NULL DEFAULT false,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- ==============================================
-- 7. DERIVED BALANCE FUNCTION
-- ==============================================
CREATE OR REPLACE FUNCTION public.get_wallet_balance(p_user_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT balance_after FROM public.wallet_ledger WHERE user_id = p_user_id ORDER BY created_at DESC LIMIT 1),
    0
  )
$$;

-- ==============================================
-- 8. UPDATED PROCESS_PURCHASE WITH LEDGER
-- ==============================================
CREATE OR REPLACE FUNCTION public.process_purchase(p_type transaction_type, p_description TEXT, p_amount NUMERIC, p_meta JSONB DEFAULT '{}'::jsonb)
RETURNS transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet public.wallets;
  v_transaction public.transactions;
  v_new_balance NUMERIC;
BEGIN
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = auth.uid() FOR UPDATE;
  IF v_wallet IS NULL THEN RAISE EXCEPTION 'Wallet not found'; END IF;
  IF v_wallet.balance < p_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  v_new_balance := v_wallet.balance - p_amount;
  UPDATE public.wallets SET balance = v_new_balance WHERE user_id = auth.uid();

  INSERT INTO public.wallet_ledger (user_id, amount, type, reference, balance_after)
  VALUES (auth.uid(), -p_amount, 'debit', p_description, v_new_balance);

  INSERT INTO public.transactions (user_id, type, description, amount, status, meta)
  VALUES (auth.uid(), p_type, p_description, -p_amount, 'completed', p_meta)
  RETURNING * INTO v_transaction;

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (auth.uid(), 'Purchase Complete', p_description || ' - R' || p_amount, 'purchase');

  RETURN v_transaction;
END;
$$;

-- ==============================================
-- 9. UPDATED TOP_UP WITH LEDGER
-- ==============================================
CREATE OR REPLACE FUNCTION public.top_up_wallet(p_amount NUMERIC)
RETURNS transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction public.transactions;
  v_new_balance NUMERIC;
BEGIN
  UPDATE public.wallets SET balance = balance + p_amount WHERE user_id = auth.uid()
  RETURNING balance INTO v_new_balance;

  INSERT INTO public.wallet_ledger (user_id, amount, type, reference, balance_after)
  VALUES (auth.uid(), p_amount, 'credit', 'Wallet Top Up', v_new_balance);

  INSERT INTO public.transactions (user_id, type, description, amount, status)
  VALUES (auth.uid(), 'topup', 'Wallet Top Up', p_amount, 'completed')
  RETURNING * INTO v_transaction;

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (auth.uid(), 'Top Up Successful', 'R' || p_amount || ' added to wallet', 'topup');

  RETURN v_transaction;
END;
$$;

-- ==============================================
-- 10. UPDATED TRANSFER WITH LEDGER + NOTIFICATIONS
-- ==============================================
CREATE OR REPLACE FUNCTION public.transfer_funds(p_recipient_username TEXT, p_amount NUMERIC, p_message TEXT DEFAULT '')
RETURNS transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_wallet public.wallets;
  v_recipient_profile public.profiles;
  v_transaction public.transactions;
  v_sender_new_balance NUMERIC;
  v_recipient_new_balance NUMERIC;
  v_sender_username TEXT;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  SELECT * INTO v_recipient_profile FROM public.profiles WHERE username = p_recipient_username;
  IF v_recipient_profile IS NULL THEN RAISE EXCEPTION 'Recipient not found'; END IF;
  IF v_recipient_profile.user_id = auth.uid() THEN RAISE EXCEPTION 'Cannot transfer to yourself'; END IF;

  SELECT * INTO v_sender_wallet FROM public.wallets WHERE user_id = auth.uid() FOR UPDATE;
  IF v_sender_wallet IS NULL OR v_sender_wallet.balance < p_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  SELECT username INTO v_sender_username FROM public.profiles WHERE user_id = auth.uid();

  v_sender_new_balance := v_sender_wallet.balance - p_amount;
  UPDATE public.wallets SET balance = v_sender_new_balance WHERE user_id = auth.uid();

  SELECT balance + p_amount INTO v_recipient_new_balance FROM public.wallets WHERE user_id = v_recipient_profile.user_id;
  UPDATE public.wallets SET balance = balance + p_amount WHERE user_id = v_recipient_profile.user_id;

  -- Sender ledger
  INSERT INTO public.wallet_ledger (user_id, amount, type, reference, balance_after)
  VALUES (auth.uid(), -p_amount, 'debit', 'Transfer to @' || p_recipient_username, v_sender_new_balance);
  -- Recipient ledger
  INSERT INTO public.wallet_ledger (user_id, amount, type, reference, balance_after)
  VALUES (v_recipient_profile.user_id, p_amount, 'credit', 'Transfer from @' || v_sender_username, v_recipient_new_balance);

  INSERT INTO public.transactions (user_id, type, description, amount, status, meta)
  VALUES (auth.uid(), 'transfer', 'Sent to @' || p_recipient_username, -p_amount, 'completed',
    jsonb_build_object('recipient', p_recipient_username, 'message', p_message))
  RETURNING * INTO v_transaction;

  INSERT INTO public.transactions (user_id, type, description, amount, status, meta)
  VALUES (v_recipient_profile.user_id, 'transfer', 'Received from @' || v_sender_username,
    p_amount, 'completed', jsonb_build_object('sender', v_sender_username, 'message', p_message));

  -- Notifications
  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (auth.uid(), 'Money Sent', 'R' || p_amount || ' sent to @' || p_recipient_username, 'transfer');
  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (v_recipient_profile.user_id, 'Money Received', 'R' || p_amount || ' from @' || v_sender_username, 'transfer');

  RETURN v_transaction;
END;
$$;

-- ==============================================
-- 11. UPDATED CONVERT_COINS WITH LEDGER
-- ==============================================
CREATE OR REPLACE FUNCTION public.convert_coins(p_coins NUMERIC)
RETURNS transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rand NUMERIC;
  v_coin_wallet public.coin_wallets;
  v_transaction public.transactions;
  v_new_balance NUMERIC;
BEGIN
  IF p_coins < 100 THEN RAISE EXCEPTION 'Minimum 100 ZappCoins required'; END IF;

  SELECT * INTO v_coin_wallet FROM public.coin_wallets WHERE user_id = auth.uid() FOR UPDATE;
  IF v_coin_wallet IS NULL OR v_coin_wallet.balance < p_coins THEN RAISE EXCEPTION 'Insufficient ZappCoins'; END IF;

  v_rand := p_coins / 100.0;

  UPDATE public.coin_wallets SET balance = balance - p_coins WHERE user_id = auth.uid();
  UPDATE public.profiles SET coin_balance = coin_balance - p_coins WHERE user_id = auth.uid();

  UPDATE public.wallets SET balance = balance + v_rand WHERE user_id = auth.uid()
  RETURNING balance INTO v_new_balance;

  INSERT INTO public.wallet_ledger (user_id, amount, type, reference, balance_after)
  VALUES (auth.uid(), v_rand, 'credit', 'Converted ' || p_coins || ' ZC', v_new_balance);

  INSERT INTO public.transactions (user_id, type, description, amount, status, meta)
  VALUES (auth.uid(), 'coin_conversion', 'Converted ' || p_coins || ' ZC to R' || v_rand, v_rand, 'completed',
    jsonb_build_object('coins', p_coins, 'rand_value', v_rand))
  RETURNING * INTO v_transaction;

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (auth.uid(), 'ZappCoin Converted', p_coins || ' ZC converted to R' || v_rand, 'conversion');

  RETURN v_transaction;
END;
$$;

-- ==============================================
-- 12. UPDATED COMPLETE_SURVEY WITH NOTIFICATION
-- ==============================================
CREATE OR REPLACE FUNCTION public.complete_survey(p_survey_id UUID)
RETURNS survey_completions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_survey public.surveys;
  v_completion public.survey_completions;
BEGIN
  SELECT * INTO v_survey FROM public.surveys WHERE id = p_survey_id AND active = true;
  IF v_survey IS NULL THEN RAISE EXCEPTION 'Survey not found'; END IF;

  INSERT INTO public.survey_completions (user_id, survey_id, reward_coins)
  VALUES (auth.uid(), p_survey_id, v_survey.reward_coins)
  RETURNING * INTO v_completion;

  UPDATE public.coin_wallets SET balance = balance + v_survey.reward_coins WHERE user_id = auth.uid();
  UPDATE public.profiles SET coin_balance = coin_balance + v_survey.reward_coins WHERE user_id = auth.uid();

  INSERT INTO public.transactions (user_id, type, description, amount, status, meta)
  VALUES (auth.uid(), 'survey_reward', v_survey.title || ' reward', v_survey.reward_coins, 'completed',
    jsonb_build_object('survey_id', p_survey_id::text, 'coins', v_survey.reward_coins));

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (auth.uid(), 'Survey Reward', 'Earned ' || v_survey.reward_coins || ' ZC from ' || v_survey.title, 'reward');

  RETURN v_completion;
END;
$$;

-- ==============================================
-- 13. ADMIN HELPER: VIEW ALL DATA FUNCTIONS
-- ==============================================
CREATE OR REPLACE FUNCTION public.admin_get_all_transactions()
RETURNS SETOF transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY SELECT * FROM public.transactions ORDER BY created_at DESC LIMIT 500;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_all_profiles()
RETURNS SETOF profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY SELECT * FROM public.profiles ORDER BY created_at DESC;
END;
$$;

-- ==============================================
-- 14. SEED NETWORKS
-- ==============================================
INSERT INTO public.networks (name, type, color_class, sort_order) VALUES
  ('MTN', 'airtime', 'bg-yellow-500/20 text-yellow-400', 1),
  ('Vodacom', 'airtime', 'bg-red-500/20 text-red-400', 2),
  ('Cell C', 'airtime', 'bg-blue-500/20 text-blue-400', 3),
  ('Telkom', 'airtime', 'bg-sky-500/20 text-sky-400', 4);

-- ==============================================
-- 15. SEED VOUCHER BRANDS & PRODUCTS
-- ==============================================
INSERT INTO public.voucher_brands (name, category, color_class, sort_order) VALUES
  ('Takealot', 'shopping', 'bg-blue-500/20 text-blue-400', 1),
  ('Shoprite', 'shopping', 'bg-red-500/20 text-red-400', 2),
  ('Checkers', 'shopping', 'bg-green-500/20 text-green-400', 3),
  ('Steam', 'gaming', 'bg-indigo-500/20 text-indigo-400', 4),
  ('Xbox', 'gaming', 'bg-emerald-500/20 text-emerald-400', 5),
  ('PlayStation', 'gaming', 'bg-blue-600/20 text-blue-400', 6),
  ('Netflix', 'entertainment', 'bg-red-600/20 text-red-400', 7),
  ('Spotify', 'entertainment', 'bg-green-600/20 text-green-400', 8),
  ('Betway', 'betting', 'bg-yellow-500/20 text-yellow-400', 9),
  ('Hollywoodbets', 'betting', 'bg-purple-500/20 text-purple-400', 10),
  ('Supabets', 'betting', 'bg-orange-500/20 text-orange-400', 11);

-- Insert products for each brand
INSERT INTO public.voucher_products (brand_id, value, price)
SELECT b.id, v.val, v.val
FROM public.voucher_brands b
CROSS JOIN (VALUES (50), (100), (200)) AS v(val)
WHERE b.name IN ('Shoprite', 'Checkers');

INSERT INTO public.voucher_products (brand_id, value, price)
SELECT b.id, v.val, v.val
FROM public.voucher_brands b
CROSS JOIN (VALUES (100), (200), (500)) AS v(val)
WHERE b.name IN ('Takealot', 'Steam', 'PlayStation');

INSERT INTO public.voucher_products (brand_id, value, price)
SELECT b.id, v.val, v.val
FROM public.voucher_brands b
CROSS JOIN (VALUES (100), (300), (500)) AS v(val)
WHERE b.name = 'Xbox';

INSERT INTO public.voucher_products (brand_id, value, price)
SELECT b.id, v.val, v.val
FROM public.voucher_brands b
CROSS JOIN (VALUES (99), (199), (299)) AS v(val)
WHERE b.name = 'Netflix';

INSERT INTO public.voucher_products (brand_id, value, price)
SELECT b.id, v.val, v.val
FROM public.voucher_brands b
CROSS JOIN (VALUES (60), (90), (120)) AS v(val)
WHERE b.name = 'Spotify';

INSERT INTO public.voucher_products (brand_id, value, price)
SELECT b.id, v.val, v.val
FROM public.voucher_brands b
CROSS JOIN (VALUES (50), (100), (200)) AS v(val)
WHERE b.name IN ('Betway', 'Hollywoodbets');

INSERT INTO public.voucher_products (brand_id, value, price)
SELECT b.id, v.val, v.val
FROM public.voucher_brands b
CROSS JOIN (VALUES (25), (50), (100)) AS v(val)
WHERE b.name = 'Supabets';

-- ==============================================
-- 16. INITIALIZE LEDGER FROM EXISTING WALLETS
-- ==============================================
INSERT INTO public.wallet_ledger (user_id, amount, type, reference, balance_after)
SELECT user_id, balance, 'credit', 'Initial balance migration', balance
FROM public.wallets WHERE balance > 0;

-- ==============================================
-- 17. UPDATE handle_new_wallet TO ALSO CREATE LEDGER ENTRY
-- ==============================================
CREATE OR REPLACE FUNCTION public.handle_new_wallet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.wallets (user_id, balance) VALUES (NEW.id, 1250.00);
  INSERT INTO public.wallet_ledger (user_id, amount, type, reference, balance_after)
  VALUES (NEW.id, 1250.00, 'credit', 'Welcome bonus', 1250.00);
  RETURN NEW;
END;
$$;
