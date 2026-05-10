
-- Add kyc_status column to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS kyc_status text NOT NULL DEFAULT 'unverified';
