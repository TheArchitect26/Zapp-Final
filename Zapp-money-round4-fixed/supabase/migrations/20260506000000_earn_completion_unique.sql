-- Prevent double-crediting earn completions
-- If the constraint already exists this is a no-op
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'earn_completions_user_opportunity_unique'
  ) THEN
    ALTER TABLE earn_completions
      ADD CONSTRAINT earn_completions_user_opportunity_unique
      UNIQUE (user_id, opportunity_id);
  END IF;
END $$;

-- Same guard for academy lesson completions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lesson_completions_user_lesson_unique'
  ) THEN
    ALTER TABLE lesson_completions
      ADD CONSTRAINT lesson_completions_user_lesson_unique
      UNIQUE (user_id, lesson_id);
  END IF;
END $$;
