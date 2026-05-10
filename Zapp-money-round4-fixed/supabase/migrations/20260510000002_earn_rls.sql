-- Ensure RLS is enabled on earn tables and users can only read their own rows.
-- All writes go through the service-role key (backend), so no INSERT/UPDATE policies needed.

ALTER TABLE IF EXISTS earn_completions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS lesson_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS quiz_answers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_streaks       ENABLE ROW LEVEL SECURITY;

-- earn_completions: users see only their own rows
CREATE POLICY IF NOT EXISTS "earn_completions_select_own"
  ON earn_completions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- lesson_completions: users see only their own rows
CREATE POLICY IF NOT EXISTS "lesson_completions_select_own"
  ON lesson_completions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- quiz_answers: users see only their own rows
CREATE POLICY IF NOT EXISTS "quiz_answers_select_own"
  ON quiz_answers FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- user_streaks: users see only their own row
CREATE POLICY IF NOT EXISTS "user_streaks_select_own"
  ON user_streaks FOR SELECT TO authenticated
  USING (user_id = auth.uid());
