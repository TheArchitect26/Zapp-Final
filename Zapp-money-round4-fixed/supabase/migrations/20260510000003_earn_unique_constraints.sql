-- #2: Unique constraint on lesson_completions to prevent double-completion
-- The complete_academy_lesson RPC must use INSERT ... ON CONFLICT DO NOTHING
-- so concurrent requests are handled atomically.
ALTER TABLE lesson_completions
  ADD CONSTRAINT IF NOT EXISTS lesson_completions_user_lesson_unique
  UNIQUE (user_id, lesson_id);

-- Unique constraint on earn_completions for once-type opportunities
-- (daily-type uses provider_transaction_id for idempotency instead)
CREATE UNIQUE INDEX IF NOT EXISTS earn_completions_once_unique
  ON earn_completions (user_id, opportunity_id)
  WHERE provider_transaction_id IS NULL;

-- #5: Unique constraint on user_streaks so concurrent daily claims are safe
-- The claim_daily_reward RPC must use:
--   UPDATE user_streaks SET last_claim_date = today
--   WHERE user_id = p_user_id AND last_claim_date != today
-- returning 0 rows on a duplicate claim.
ALTER TABLE user_streaks
  ADD CONSTRAINT IF NOT EXISTS user_streaks_user_unique
  UNIQUE (user_id);
