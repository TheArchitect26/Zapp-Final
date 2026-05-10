/**
 * AI scoring endpoint — ADVISORY ONLY.
 * Results from this endpoint MUST NOT directly modify balances, ledger entries,
 * or trigger financial transactions. They are signals for routing decisions only.
 */
import express from "express";
import { z } from "zod";

const router = express.Router();

const aiScoreSchema = z.object({
  amount:    z.number({ required_error: "amount is required" }).positive(),
  speed:     z.number().min(0).max(1).default(0),
  liquidity: z.number().min(0).max(1).default(0),
});

/**
 * POST /api/v1/ai/ai-score
 * Returns an advisory routing score. Does not affect any financial state.
 */
router.post("/ai-score", (req, res) => {
  const parsed = aiScoreSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: "INVALID_INPUT",
      details: parsed.error.flatten(),
    });
  }

  const { amount, speed, liquidity } = parsed.data;

  // Advisory score — purely read-only computation, no side effects
  const score =
    (amount > 10000 ? 0.4 : 0.1) +
    speed * 0.3 +
    liquidity * 0.3;

  return res.json({
    score: Math.min(score, 1),
    engine: "v5-ai-core",
    advisory: true,
  });
});

export default router;
