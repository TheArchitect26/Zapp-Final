
-- Daily rewards tracking
CREATE TABLE public.daily_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  streak_day integer NOT NULL DEFAULT 1,
  coin_reward numeric NOT NULL DEFAULT 0,
  claimed_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.daily_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own daily rewards" ON public.daily_rewards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own daily rewards" ON public.daily_rewards FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User streaks
CREATE TABLE public.user_streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_claim_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own streak" ON public.user_streaks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own streak" ON public.user_streaks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own streak" ON public.user_streaks FOR UPDATE USING (auth.uid() = user_id);

-- Academy lessons
CREATE TABLE public.academy_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'basics',
  content_type text NOT NULL DEFAULT 'text',
  content_url text,
  content_body text,
  has_quiz boolean NOT NULL DEFAULT false,
  coin_reward numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.academy_lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active lessons" ON public.academy_lessons FOR SELECT USING (status = 'active');
CREATE POLICY "Admins can manage lessons" ON public.academy_lessons FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Lesson completions
CREATE TABLE public.lesson_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lesson_id uuid NOT NULL REFERENCES public.academy_lessons(id) ON DELETE CASCADE,
  coin_reward numeric NOT NULL DEFAULT 0,
  completed_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);
ALTER TABLE public.lesson_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own lesson completions" ON public.lesson_completions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own lesson completions" ON public.lesson_completions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Rewarded ad sessions
CREATE TABLE public.rewarded_ad_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reward_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  provider text NOT NULL DEFAULT 'internal',
  provider_reference text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.rewarded_ad_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own ad sessions" ON public.rewarded_ad_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ad sessions" ON public.rewarded_ad_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Feed events
CREATE TABLE public.feed_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  title text NOT NULL,
  description text,
  amount numeric,
  hide_amount boolean NOT NULL DEFAULT false,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.feed_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view feed" ON public.feed_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own feed events" ON public.feed_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage feed" ON public.feed_events FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Feed likes
CREATE TABLE public.feed_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_id uuid NOT NULL REFERENCES public.feed_events(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, event_id)
);
ALTER TABLE public.feed_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view likes" ON public.feed_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own likes" ON public.feed_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own likes" ON public.feed_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Feed visibility settings
CREATE TABLE public.feed_visibility_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  show_activity boolean NOT NULL DEFAULT true,
  show_amounts boolean NOT NULL DEFAULT false,
  anonymous_mode boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.feed_visibility_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own visibility settings" ON public.feed_visibility_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own visibility settings" ON public.feed_visibility_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own visibility settings" ON public.feed_visibility_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Authenticated can view all visibility settings" ON public.feed_visibility_settings FOR SELECT TO authenticated USING (true);

-- RPC: Claim daily reward
CREATE OR REPLACE FUNCTION public.claim_daily_reward()
RETURNS daily_rewards
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_streak public.user_streaks;
  v_new_day integer;
  v_reward numeric;
  v_claim public.daily_rewards;
  v_new_balance numeric;
  v_base_rewards numeric[] := ARRAY[0.50, 0.75, 1.00, 1.50, 2.00, 3.00, 5.00];
BEGIN
  -- Get or create streak
  SELECT * INTO v_streak FROM public.user_streaks WHERE user_id = auth.uid() FOR UPDATE;
  IF v_streak IS NULL THEN
    INSERT INTO public.user_streaks (user_id, current_streak, longest_streak) VALUES (auth.uid(), 0, 0)
    RETURNING * INTO v_streak;
  END IF;

  -- Check if already claimed today
  IF v_streak.last_claim_date = CURRENT_DATE THEN
    RAISE EXCEPTION 'Already claimed today';
  END IF;

  -- Calculate streak
  IF v_streak.last_claim_date = CURRENT_DATE - 1 THEN
    v_new_day := LEAST(v_streak.current_streak + 1, 7);
  ELSE
    v_new_day := 1;
  END IF;

  v_reward := v_base_rewards[v_new_day];

  -- Update streak
  UPDATE public.user_streaks SET
    current_streak = v_new_day,
    longest_streak = GREATEST(longest_streak, v_new_day),
    last_claim_date = CURRENT_DATE,
    updated_at = now()
  WHERE user_id = auth.uid();

  -- Insert claim
  INSERT INTO public.daily_rewards (user_id, streak_day, coin_reward)
  VALUES (auth.uid(), v_new_day, v_reward * 100)
  RETURNING * INTO v_claim;

  -- Credit wallet directly in ZAR
  UPDATE public.wallets SET balance = balance + v_reward WHERE user_id = auth.uid()
  RETURNING balance INTO v_new_balance;

  INSERT INTO public.wallet_ledger (user_id, amount, type, reference, balance_after)
  VALUES (auth.uid(), v_reward, 'credit', 'Daily reward day ' || v_new_day, v_new_balance);

  INSERT INTO public.transactions (user_id, type, description, amount, status, meta)
  VALUES (auth.uid(), 'survey_reward', 'Daily reward - Day ' || v_new_day, v_reward, 'completed',
    jsonb_build_object('type', 'daily_reward', 'streak_day', v_new_day));

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (auth.uid(), 'Daily Reward', 'R' || v_reward || ' earned! Day ' || v_new_day || ' streak 🔥', 'reward');

  -- Feed event
  INSERT INTO public.feed_events (user_id, event_type, title, description, amount)
  VALUES (auth.uid(), 'earning', 'Daily Reward', 'Claimed day ' || v_new_day || ' streak reward', v_reward);

  RETURN v_claim;
END;
$$;

-- RPC: Complete academy lesson
CREATE OR REPLACE FUNCTION public.complete_academy_lesson(p_lesson_id uuid)
RETURNS lesson_completions
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_lesson public.academy_lessons;
  v_completion public.lesson_completions;
  v_rand numeric;
  v_new_balance numeric;
BEGIN
  SELECT * INTO v_lesson FROM public.academy_lessons WHERE id = p_lesson_id AND status = 'active';
  IF v_lesson IS NULL THEN RAISE EXCEPTION 'Lesson not found'; END IF;

  -- Check duplicate
  IF EXISTS (SELECT 1 FROM public.lesson_completions WHERE user_id = auth.uid() AND lesson_id = p_lesson_id) THEN
    RAISE EXCEPTION 'Already completed';
  END IF;

  v_rand := v_lesson.coin_reward / 100.0;

  INSERT INTO public.lesson_completions (user_id, lesson_id, coin_reward)
  VALUES (auth.uid(), p_lesson_id, v_lesson.coin_reward)
  RETURNING * INTO v_completion;

  -- Credit wallet
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

-- Enable realtime for feed_events
ALTER PUBLICATION supabase_realtime ADD TABLE public.feed_events;

-- Indexes
CREATE INDEX idx_feed_events_created ON public.feed_events (created_at DESC);
CREATE INDEX idx_feed_events_user ON public.feed_events (user_id);
CREATE INDEX idx_daily_rewards_user ON public.daily_rewards (user_id, claimed_at DESC);
CREATE INDEX idx_rewarded_ad_sessions_user ON public.rewarded_ad_sessions (user_id, created_at DESC);
