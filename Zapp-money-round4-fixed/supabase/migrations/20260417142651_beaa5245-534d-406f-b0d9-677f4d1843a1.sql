-- Badges system
CREATE TABLE public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL DEFAULT 'award',
  color_class text NOT NULL DEFAULT 'bg-primary text-primary-foreground',
  bonus_reward numeric NOT NULL DEFAULT 0,
  criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active badges" ON public.badges
  FOR SELECT USING (status = 'active');
CREATE POLICY "Admins can manage badges" ON public.badges
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE TABLE public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  bonus_paid numeric NOT NULL DEFAULT 0,
  UNIQUE(user_id, badge_id)
);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own badges" ON public.user_badges
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Authenticated view all badges (for feed)" ON public.user_badges
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage user badges" ON public.user_badges
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Seed initial badges
INSERT INTO public.badges (code, name, description, icon, color_class, bonus_reward, criteria, sort_order) VALUES
('survey_pro', 'Survey Pro', 'Complete 10 surveys', 'target', 'bg-blue-500/20 text-blue-400 border-blue-500/40', 2.00, '{"type":"survey_count","threshold":10}'::jsonb, 1),
('daily_grinder', 'Daily Grinder', 'Maintain a 7-day streak', 'flame', 'bg-orange-500/20 text-orange-400 border-orange-500/40', 3.00, '{"type":"streak","threshold":7}'::jsonb, 2),
('academy_graduate', 'Academy Graduate', 'Complete every Academy lesson', 'graduation-cap', 'bg-purple-500/20 text-purple-400 border-purple-500/40', 5.00, '{"type":"academy_complete"}'::jsonb, 3),
('referral_king', 'Referral King', 'Refer 5 active users', 'crown', 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40', 5.00, '{"type":"referrals","threshold":5}'::jsonb, 4);

-- Function to evaluate and award badges
CREATE OR REPLACE FUNCTION public.evaluate_user_badges()
RETURNS SETOF public.user_badges
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_badge public.badges;
  v_count integer;
  v_awarded public.user_badges;
  v_lesson_total integer;
  v_lesson_done integer;
  v_streak integer;
  v_new_balance numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  FOR v_badge IN SELECT * FROM public.badges WHERE status = 'active' LOOP
    -- Skip if already awarded
    IF EXISTS (SELECT 1 FROM public.user_badges WHERE user_id = v_uid AND badge_id = v_badge.id) THEN
      CONTINUE;
    END IF;

    -- Evaluate criteria
    IF v_badge.criteria->>'type' = 'survey_count' THEN
      SELECT count(*) INTO v_count FROM public.transactions
        WHERE user_id = v_uid AND type = 'survey_reward'
          AND COALESCE((meta->>'type'),'') NOT IN ('daily_reward','academy');
      IF v_count < (v_badge.criteria->>'threshold')::int THEN CONTINUE; END IF;

    ELSIF v_badge.criteria->>'type' = 'streak' THEN
      SELECT COALESCE(longest_streak, 0) INTO v_streak FROM public.user_streaks WHERE user_id = v_uid;
      IF COALESCE(v_streak,0) < (v_badge.criteria->>'threshold')::int THEN CONTINUE; END IF;

    ELSIF v_badge.criteria->>'type' = 'academy_complete' THEN
      SELECT count(*) INTO v_lesson_total FROM public.academy_lessons WHERE status = 'active';
      SELECT count(*) INTO v_lesson_done FROM public.lesson_completions lc
        JOIN public.academy_lessons al ON al.id = lc.lesson_id
        WHERE lc.user_id = v_uid AND al.status = 'active';
      IF v_lesson_total = 0 OR v_lesson_done < v_lesson_total THEN CONTINUE; END IF;

    ELSIF v_badge.criteria->>'type' = 'referrals' THEN
      SELECT count(*) INTO v_count FROM public.referrals WHERE referrer_id = v_uid;
      IF v_count < (v_badge.criteria->>'threshold')::int THEN CONTINUE; END IF;
    ELSE
      CONTINUE;
    END IF;

    -- Award badge
    INSERT INTO public.user_badges (user_id, badge_id, bonus_paid)
    VALUES (v_uid, v_badge.id, v_badge.bonus_reward)
    RETURNING * INTO v_awarded;

    -- Pay bonus to wallet
    IF v_badge.bonus_reward > 0 THEN
      UPDATE public.wallets SET balance = balance + v_badge.bonus_reward
        WHERE user_id = v_uid RETURNING balance INTO v_new_balance;
      INSERT INTO public.wallet_ledger (user_id, amount, type, reference, balance_after)
        VALUES (v_uid, v_badge.bonus_reward, 'credit', 'Badge bonus: ' || v_badge.name, v_new_balance);
      INSERT INTO public.transactions (user_id, type, description, amount, status, meta)
        VALUES (v_uid, 'survey_reward', 'Badge bonus: ' || v_badge.name, v_badge.bonus_reward, 'completed',
          jsonb_build_object('type','badge_bonus','badge_code', v_badge.code));
      INSERT INTO public.feed_events (user_id, event_type, title, description, amount)
        VALUES (v_uid, 'badge', 'Badge Unlocked', 'Earned ' || v_badge.name || ' 🏆', v_badge.bonus_reward);
    END IF;

    INSERT INTO public.notifications (user_id, title, message, type)
      VALUES (v_uid, 'Badge Unlocked 🏆', v_badge.name || ' — R' || v_badge.bonus_reward || ' bonus', 'reward');

    RETURN NEXT v_awarded;
  END LOOP;

  RETURN;
END;
$$;