import express from "express";
import { z } from "zod";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { sendPush } from "../services/pushNotification.service.js";
import { auditLog } from "../lib/auditLog.js";
import { logger } from "../lib/logger.js";
import { zcToFiat, getUserCurrency } from "../services/coinRate.service.js";

const router = express.Router();

// POST /api/v1/earn/complete
router.post("/complete", async (req, res, next) => {
  try {
    const parsed = z.object({ opportunity_id: z.string().uuid() }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: "INVALID_INPUT", details: parsed.error.flatten() });
    }

    const { opportunity_id } = parsed.data;
    const userId = req.user.id;

    // #4: select only needed fields, not *
    const { data: opp, error: oppErr } = await supabaseAdmin
      .from("earn_opportunities")
      .select("id, title, status, availability_type, reward_amount")
      .eq("id", opportunity_id)
      .single();
    if (oppErr || !opp) return res.status(404).json({ success: false, error: "OPPORTUNITY_NOT_FOUND" });
    if (opp.status !== "active") return res.status(400).json({ success: false, error: "OPPORTUNITY_INACTIVE" });

    if (opp.availability_type === "once") {
      const { count } = await supabaseAdmin
        .from("earn_completions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("opportunity_id", opportunity_id);
      if ((count ?? 0) > 0) return res.status(409).json({ success: false, error: "ALREADY_COMPLETED" });
    } else if (opp.availability_type === "daily") {
      // #5: UTC day window with explicit upper bound
      const now = new Date();
      const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const dayEnd   = new Date(dayStart.getTime() + 86_400_000);
      const { count } = await supabaseAdmin
        .from("earn_completions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("opportunity_id", opportunity_id)
        .gte("completed_at", dayStart.toISOString())
        .lt("completed_at",  dayEnd.toISOString());
      if ((count ?? 0) > 0) return res.status(409).json({ success: false, error: "ALREADY_COMPLETED_TODAY" });
    }

    const { data, error } = await supabaseAdmin.rpc("complete_earn_opportunity", {
      p_opportunity_id: opportunity_id,
      p_user_id: userId,
    });
    if (error) throw error;

    const zcReward = data?.coin_reward ?? data?.reward ?? opp.reward_amount;
    const currencyCode = await getUserCurrency(userId);
    const fiat = await zcToFiat(zcReward, currencyCode);

    // audit log on earn completion
    auditLog.earnCompleted(userId, opportunity_id, zcReward);

    // safe push body
    sendPush(userId, {
      title: "Reward Earned!",
      body: fiat.amount != null
        ? `You earned ${fiat.symbol}${fiat.amount.toFixed(2)} from ${opp.title}`
        : `You completed ${opp.title}`,
    }).catch(() => {});

    return res.json({ success: true, zc_reward: zcReward, fiat });
  } catch (err) {
    logger.error("earn/complete error", { error: err.message });
    return next(err);
  }
});

// POST /api/v1/earn/daily
router.post("/daily", async (req, res, next) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split("T")[0];

    const { data: streak } = await supabaseAdmin
      .from("user_streaks")
      .select("last_claim_date, current_day")
      .eq("user_id", userId)
      .maybeSingle();

    // Pre-check only — two concurrent requests can both pass this before either calls the RPC.
    // The authoritative once-per-day enforcement must be inside claim_daily_reward (DB-level).
    if (streak?.last_claim_date === today) {
      return res.status(409).json({ success: false, error: "ALREADY_CLAIMED_TODAY" });
    }

    const { data, error } = await supabaseAdmin.rpc("claim_daily_reward", { p_user_id: userId });
    if (error) throw error;

    const zcReward = data?.coin_reward ?? data?.reward;
    const currencyCode = await getUserCurrency(userId);
    const fiat = zcReward != null ? await zcToFiat(zcReward, currencyCode) : null;

    return res.json({ success: true, streak_day: data?.streak_day ?? data?.current_day, zc_reward: zcReward, fiat });
  } catch (err) {
    logger.error("earn/daily error", { error: err.message });
    return next(err);
  }
});

// POST /api/v1/earn/academy/complete
router.post("/academy/complete", async (req, res, next) => {
  try {
    const parsed = z.object({ lesson_id: z.string().uuid() }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: "INVALID_INPUT", details: parsed.error.flatten() });
    }

    const { lesson_id } = parsed.data;
    const userId = req.user.id;

    // #4: select only needed fields
    const { data: lesson, error: lessonErr } = await supabaseAdmin
      .from("academy_lessons")
      .select("id, title, status, requires_quiz, reward_amount")
      .eq("id", lesson_id)
      .single();
    if (lessonErr || !lesson) return res.status(404).json({ success: false, error: "LESSON_NOT_FOUND" });
    if (lesson.status !== "active") return res.status(400).json({ success: false, error: "LESSON_INACTIVE" });

    const { count: doneCount } = await supabaseAdmin
      .from("lesson_completions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("lesson_id", lesson_id);
    if ((doneCount ?? 0) > 0) return res.status(409).json({ success: false, error: "ALREADY_COMPLETED" });

    if (lesson.requires_quiz) {
      const { count: quizCount } = await supabaseAdmin
        .from("quiz_answers")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("lesson_id", lesson_id)
        .eq("is_correct", true);
      if ((quizCount ?? 0) === 0) {
        return res.status(403).json({ success: false, error: "QUIZ_REQUIRED" });
      }
    }

    const { data, error } = await supabaseAdmin.rpc("complete_academy_lesson", {
      p_lesson_id: lesson_id,
      p_user_id: userId,
    });
    if (error) throw error;

    const zcReward = data?.coin_reward ?? data?.reward ?? lesson.reward_amount;
    const currencyCode = await getUserCurrency(userId);
    const fiat = await zcToFiat(zcReward, currencyCode);

    // audit log
    auditLog.academyCompleted(userId, lesson_id, zcReward);

    return res.json({ success: true, zc_reward: zcReward, fiat });
  } catch (err) {
    logger.error("earn/academy/complete error", { error: err.message });
    return next(err);
  }
});

// POST /api/v1/earn/academy/quiz-answer
// Receives quiz answer from frontend; evaluates correctness server-side.
router.post("/academy/quiz-answer", async (req, res, next) => {
  try {
    const parsed = z.object({
      quiz_id:        z.string().uuid(),
      lesson_id:      z.string().uuid(),
      selected_index: z.number().int().min(0),
    }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: "INVALID_INPUT", details: parsed.error.flatten() });
    }

    const { quiz_id, lesson_id, selected_index } = parsed.data;
    const userId = req.user.id;

    // #7: reject if lesson already completed
    const { count: completedCount } = await supabaseAdmin
      .from("lesson_completions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("lesson_id", lesson_id);
    if ((completedCount ?? 0) > 0) {
      return res.status(409).json({ success: false, error: "LESSON_ALREADY_COMPLETED" });
    }

    // #1: reject if already answered this quiz
    const { count: answerCount } = await supabaseAdmin
      .from("quiz_answers")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("quiz_id", quiz_id);
    if ((answerCount ?? 0) > 0) {
      return res.status(409).json({ success: false, error: "ALREADY_ANSWERED" });
    }

    // Fetch the quiz to evaluate correctness server-side
    const { data: quiz, error: quizErr } = await supabaseAdmin
      .from("academy_quizzes")
      .select("id, lesson_id, correct_index")
      .eq("id", quiz_id)
      .eq("lesson_id", lesson_id)
      .single();
    if (quizErr || !quiz) return res.status(404).json({ success: false, error: "QUIZ_NOT_FOUND" });

    const is_correct = quiz.correct_index === selected_index;

    const { error } = await supabaseAdmin.from("quiz_answers").insert({
      quiz_id,
      lesson_id,
      user_id: userId,
      selected_index,
      is_correct,
    });
    if (error) throw error;

    return res.json({ success: true, is_correct });
  } catch (err) {
    logger.error("earn/academy/quiz-answer error", { error: err.message });
    return next(err);
  }
});

export default router;
