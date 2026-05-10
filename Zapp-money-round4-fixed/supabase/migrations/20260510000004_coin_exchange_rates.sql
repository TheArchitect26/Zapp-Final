CREATE TABLE public.coin_exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  currency_code char(3) NOT NULL UNIQUE,
  zc_per_unit numeric(18,6) NOT NULL,
  min_withdrawal_zc integer NOT NULL DEFAULT 500,
  display_decimals smallint NOT NULL DEFAULT 2,
  symbol text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.coin_exchange_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active rates"
  ON public.coin_exchange_rates FOR SELECT USING (active = true);

CREATE POLICY "Admins can manage rates"
  ON public.coin_exchange_rates FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.coin_exchange_rates
  (currency_code, zc_per_unit, min_withdrawal_zc, symbol) VALUES
  ('ZAR', 100,  500,  'R'),
  ('NGN', 10,   5000, '₦'),
  ('KES', 8,    4000, 'KSh'),
  ('GHS', 120,  600,  'GH₵'),
  ('USD', 1500, 750,  '$');

-- Add currency_code to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS currency_code char(3) NOT NULL DEFAULT 'ZAR';

-- Allow runtime override via app.default_currency setting
ALTER TABLE public.profiles
  ALTER COLUMN currency_code SET DEFAULT
    COALESCE(current_setting('app.default_currency', true), 'ZAR');
