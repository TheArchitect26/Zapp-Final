
-- Create timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  username TEXT UNIQUE,
  phone_number TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'username', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create wallets table
CREATE TABLE public.wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own wallet" ON public.wallets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own wallet" ON public.wallets FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_wallets_updated_at
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create wallet on signup with R1250 starter balance
CREATE OR REPLACE FUNCTION public.handle_new_wallet()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.wallets (user_id, balance) VALUES (NEW.id, 1250.00);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created_wallet
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_wallet();

-- Create transactions table
CREATE TYPE public.transaction_type AS ENUM ('airtime', 'electricity', 'voucher', 'topup');
CREATE TYPE public.transaction_status AS ENUM ('completed', 'pending', 'failed');

CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.transaction_type NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  status public.transaction_status NOT NULL DEFAULT 'completed',
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own transactions" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_transactions_created_at ON public.transactions(created_at DESC);

-- Function to process a purchase (debit wallet + create transaction atomically)
CREATE OR REPLACE FUNCTION public.process_purchase(
  p_type public.transaction_type,
  p_description TEXT,
  p_amount NUMERIC,
  p_meta JSONB DEFAULT '{}'
)
RETURNS public.transactions AS $$
DECLARE
  v_wallet public.wallets;
  v_transaction public.transactions;
BEGIN
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = auth.uid() FOR UPDATE;
  
  IF v_wallet IS NULL THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;
  
  IF v_wallet.balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;
  
  UPDATE public.wallets SET balance = balance - p_amount WHERE user_id = auth.uid();
  
  INSERT INTO public.transactions (user_id, type, description, amount, status, meta)
  VALUES (auth.uid(), p_type, p_description, -p_amount, 'completed', p_meta)
  RETURNING * INTO v_transaction;
  
  RETURN v_transaction;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to top up wallet
CREATE OR REPLACE FUNCTION public.top_up_wallet(p_amount NUMERIC)
RETURNS public.transactions AS $$
DECLARE
  v_transaction public.transactions;
BEGIN
  UPDATE public.wallets SET balance = balance + p_amount WHERE user_id = auth.uid();
  
  INSERT INTO public.transactions (user_id, type, description, amount, status)
  VALUES (auth.uid(), 'topup', 'Wallet Top Up', p_amount, 'completed')
  RETURNING * INTO v_transaction;
  
  RETURN v_transaction;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
