CREATE TABLE IF NOT EXISTS public.fee_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_type text UNIQUE NOT NULL,
  percentage_fee numeric NOT NULL DEFAULT 4,
  min_fee numeric NOT NULL DEFAULT 2,
  max_fee numeric NOT NULL DEFAULT 15,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.fee_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage fees" ON public.fee_config
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated read fees" ON public.fee_config
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.fee_config (fee_type, percentage_fee, min_fee, max_fee)
VALUES ('withdrawal', 4, 2, 15)
ON CONFLICT (fee_type) DO NOTHING;
