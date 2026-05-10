CREATE TABLE IF NOT EXISTS public.kyc_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  smile_job_id text,
  id_number_last4 text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','verified','failed','manual_review')),
  failure_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own submissions" ON public.kyc_submissions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins see all kyc" ON public.kyc_submissions
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));
