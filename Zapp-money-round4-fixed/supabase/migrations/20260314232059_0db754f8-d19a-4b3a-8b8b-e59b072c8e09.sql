
-- Add new transaction types
ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'transfer';
ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'survey_reward';
ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'coin_conversion';
ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'withdrawal';
