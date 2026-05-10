
-- Coin wallets table
CREATE TABLE public.coin_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  balance numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.coin_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own coin wallet" ON public.coin_wallets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own coin wallet" ON public.coin_wallets FOR UPDATE USING (auth.uid() = user_id);

-- Surveys table
CREATE TABLE public.surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  estimated_minutes integer NOT NULL DEFAULT 5,
  reward_coins numeric NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'general',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active surveys" ON public.surveys FOR SELECT USING (active = true);

-- Survey completions
CREATE TABLE public.survey_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  reward_coins numeric NOT NULL DEFAULT 0,
  UNIQUE(user_id, survey_id)
);
ALTER TABLE public.survey_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own completions" ON public.survey_completions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own completions" ON public.survey_completions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Referrals table
CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL,
  referred_id uuid NOT NULL,
  reward_coins numeric NOT NULL DEFAULT 500,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(referred_id)
);
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own referrals" ON public.referrals FOR SELECT USING (auth.uid() = referrer_id);

-- Add referral_code to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;
-- Add coin balance tracking
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS coin_balance numeric NOT NULL DEFAULT 0;

-- Create coin wallet on user signup (update existing trigger function)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_referral_code text;
BEGIN
  v_referral_code := 'ZAPP-' || upper(substring(md5(NEW.id::text) from 1 for 6));
  
  INSERT INTO public.profiles (user_id, full_name, username, referral_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'username', ''),
    v_referral_code
  );
  
  INSERT INTO public.coin_wallets (user_id, balance) VALUES (NEW.id, 0);
  
  RETURN NEW;
END;
$$;

-- Transfer funds function
CREATE OR REPLACE FUNCTION public.transfer_funds(p_recipient_username text, p_amount numeric, p_message text DEFAULT '')
RETURNS transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sender_wallet public.wallets;
  v_recipient_profile public.profiles;
  v_transaction public.transactions;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  SELECT * INTO v_recipient_profile FROM public.profiles WHERE username = p_recipient_username;
  IF v_recipient_profile IS NULL THEN
    RAISE EXCEPTION 'Recipient not found';
  END IF;
  IF v_recipient_profile.user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot transfer to yourself';
  END IF;

  SELECT * INTO v_sender_wallet FROM public.wallets WHERE user_id = auth.uid() FOR UPDATE;
  IF v_sender_wallet IS NULL OR v_sender_wallet.balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  UPDATE public.wallets SET balance = balance - p_amount WHERE user_id = auth.uid();
  UPDATE public.wallets SET balance = balance + p_amount WHERE user_id = v_recipient_profile.user_id;

  INSERT INTO public.transactions (user_id, type, description, amount, status, meta)
  VALUES (auth.uid(), 'transfer', 'Sent to @' || p_recipient_username, -p_amount, 'completed',
    jsonb_build_object('recipient', p_recipient_username, 'message', p_message))
  RETURNING * INTO v_transaction;

  INSERT INTO public.transactions (user_id, type, description, amount, status, meta)
  VALUES (v_recipient_profile.user_id, 'transfer', 'Received from @' || (SELECT username FROM public.profiles WHERE user_id = auth.uid()),
    p_amount, 'completed', jsonb_build_object('sender', (SELECT username FROM public.profiles WHERE user_id = auth.uid()), 'message', p_message));

  RETURN v_transaction;
END;
$$;

-- Complete survey function
CREATE OR REPLACE FUNCTION public.complete_survey(p_survey_id uuid)
RETURNS survey_completions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_survey public.surveys;
  v_completion public.survey_completions;
BEGIN
  SELECT * INTO v_survey FROM public.surveys WHERE id = p_survey_id AND active = true;
  IF v_survey IS NULL THEN
    RAISE EXCEPTION 'Survey not found';
  END IF;

  INSERT INTO public.survey_completions (user_id, survey_id, reward_coins)
  VALUES (auth.uid(), p_survey_id, v_survey.reward_coins)
  RETURNING * INTO v_completion;

  UPDATE public.coin_wallets SET balance = balance + v_survey.reward_coins WHERE user_id = auth.uid();
  UPDATE public.profiles SET coin_balance = coin_balance + v_survey.reward_coins WHERE user_id = auth.uid();

  INSERT INTO public.transactions (user_id, type, description, amount, status, meta)
  VALUES (auth.uid(), 'survey_reward', v_survey.title || ' reward', v_survey.reward_coins, 'completed',
    jsonb_build_object('survey_id', p_survey_id::text, 'coins', v_survey.reward_coins));

  RETURN v_completion;
END;
$$;

-- Convert coins to wallet balance
CREATE OR REPLACE FUNCTION public.convert_coins(p_coins numeric)
RETURNS transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rand numeric;
  v_coin_wallet public.coin_wallets;
  v_transaction public.transactions;
BEGIN
  IF p_coins < 100 THEN
    RAISE EXCEPTION 'Minimum 100 ZappCoins required';
  END IF;

  SELECT * INTO v_coin_wallet FROM public.coin_wallets WHERE user_id = auth.uid() FOR UPDATE;
  IF v_coin_wallet IS NULL OR v_coin_wallet.balance < p_coins THEN
    RAISE EXCEPTION 'Insufficient ZappCoins';
  END IF;

  v_rand := p_coins / 100.0;

  UPDATE public.coin_wallets SET balance = balance - p_coins WHERE user_id = auth.uid();
  UPDATE public.profiles SET coin_balance = coin_balance - p_coins WHERE user_id = auth.uid();
  UPDATE public.wallets SET balance = balance + v_rand WHERE user_id = auth.uid();

  INSERT INTO public.transactions (user_id, type, description, amount, status, meta)
  VALUES (auth.uid(), 'coin_conversion', 'Converted ' || p_coins || ' ZC to R' || v_rand, v_rand, 'completed',
    jsonb_build_object('coins', p_coins, 'rand_value', v_rand))
  RETURNING * INTO v_transaction;

  RETURN v_transaction;
END;
$$;

-- Seed some surveys
INSERT INTO public.surveys (title, description, estimated_minutes, reward_coins, category) VALUES
  ('Shopping Habits Survey', 'Tell us about your shopping preferences', 5, 50, 'lifestyle'),
  ('Mobile Usage Survey', 'How do you use your smartphone?', 3, 30, 'tech'),
  ('Entertainment Preferences', 'What do you watch and listen to?', 4, 40, 'entertainment'),
  ('Financial Goals Survey', 'Share your savings and spending goals', 7, 75, 'finance'),
  ('Food & Dining Survey', 'Your food preferences and dining habits', 5, 50, 'lifestyle'),
  ('Social Media Survey', 'How you use social media platforms', 3, 25, 'tech');
