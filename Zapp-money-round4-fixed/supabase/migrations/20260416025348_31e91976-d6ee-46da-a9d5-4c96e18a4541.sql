
-- Add columns to academy_lessons
ALTER TABLE public.academy_lessons
  ADD COLUMN IF NOT EXISTS min_time_seconds integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS quiz_pass_required boolean NOT NULL DEFAULT false;

-- Academy quizzes
CREATE TABLE IF NOT EXISTS public.academy_quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.academy_lessons(id) ON DELETE CASCADE,
  question text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]',
  correct_index integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.academy_quizzes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view quizzes" ON public.academy_quizzes FOR SELECT USING (true);
CREATE POLICY "Admins can manage quizzes" ON public.academy_quizzes FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Quiz answers
CREATE TABLE IF NOT EXISTS public.quiz_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  quiz_id uuid NOT NULL REFERENCES public.academy_quizzes(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.academy_lessons(id) ON DELETE CASCADE,
  selected_index integer NOT NULL,
  is_correct boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.quiz_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own quiz answers" ON public.quiz_answers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own quiz answers" ON public.quiz_answers FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Update complete_academy_lesson to check quiz if required
CREATE OR REPLACE FUNCTION public.complete_academy_lesson(p_lesson_id uuid)
RETURNS lesson_completions
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_lesson public.academy_lessons;
  v_completion public.lesson_completions;
  v_rand numeric;
  v_new_balance numeric;
  v_quiz_count integer;
  v_correct_count integer;
  v_pass_rate numeric;
BEGIN
  SELECT * INTO v_lesson FROM public.academy_lessons WHERE id = p_lesson_id AND status = 'active';
  IF v_lesson IS NULL THEN RAISE EXCEPTION 'Lesson not found'; END IF;

  IF EXISTS (SELECT 1 FROM public.lesson_completions WHERE user_id = auth.uid() AND lesson_id = p_lesson_id) THEN
    RAISE EXCEPTION 'Already completed';
  END IF;

  -- Check quiz if required
  IF v_lesson.quiz_pass_required OR v_lesson.has_quiz THEN
    SELECT count(*) INTO v_quiz_count FROM public.academy_quizzes WHERE lesson_id = p_lesson_id;
    IF v_quiz_count > 0 THEN
      SELECT count(*) INTO v_correct_count FROM public.quiz_answers
        WHERE user_id = auth.uid() AND lesson_id = p_lesson_id AND is_correct = true;
      v_pass_rate := v_correct_count::numeric / v_quiz_count::numeric;
      IF v_pass_rate < 0.7 THEN
        RAISE EXCEPTION 'Quiz not passed (%.0f%% correct, need 70%%)', v_pass_rate * 100;
      END IF;
    END IF;
  END IF;

  v_rand := v_lesson.coin_reward / 100.0;

  INSERT INTO public.lesson_completions (user_id, lesson_id, coin_reward)
  VALUES (auth.uid(), p_lesson_id, v_lesson.coin_reward)
  RETURNING * INTO v_completion;

  UPDATE public.wallets SET balance = balance + v_rand WHERE user_id = auth.uid()
  RETURNING balance INTO v_new_balance;

  INSERT INTO public.wallet_ledger (user_id, amount, type, reference, balance_after)
  VALUES (auth.uid(), v_rand, 'credit', 'Academy: ' || v_lesson.title, v_new_balance);

  INSERT INTO public.transactions (user_id, type, description, amount, status, meta)
  VALUES (auth.uid(), 'survey_reward', 'Academy: ' || v_lesson.title, v_rand, 'completed',
    jsonb_build_object('type', 'academy', 'lesson_id', p_lesson_id::text));

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (auth.uid(), 'Lesson Complete', 'Earned R' || v_rand || ' from ' || v_lesson.title, 'reward');

  INSERT INTO public.feed_events (user_id, event_type, title, description, amount)
  VALUES (auth.uid(), 'earning', 'Academy Complete', 'Completed ' || v_lesson.title, v_rand);

  RETURN v_completion;
END;
$$;
