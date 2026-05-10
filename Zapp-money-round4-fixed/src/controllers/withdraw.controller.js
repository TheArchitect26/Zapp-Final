import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { logger } from "../lib/logger.js";
import { z } from "zod";
import { db } from "../db/index.js";
import { processWithdrawal } from "../services/withdrawal.service.js";

const withdrawSchema = z.object({
  amount: z.number().positive().max(50_000, "Withdrawal exceeds maximum"),
  payoutMethodId: z.string().uuid().optional().nullable(),
});

export async function requestWithdrawal(req, res, next) {
  try {
    // ── Input validation ──────────────────────────────────────────────────
    const parsed = withdrawSchema.safeParse({
      ...req.body,
      amount: Number(req.body?.amount),
    });
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "INVALID_INPUT",
        details: parsed.error.flatten(),
      });
    }

    const { amount, payoutMethodId } = parsed.data;
    const userId = req.user.id;

    // ── Idempotency ───────────────────────────────────────────────────────
    const idempotencyKey = req.headers["idempotency-key"] || null;
    if (idempotencyKey) {
      try {
        const existing = await db.query(
          `SELECT response FROM idempotency_keys WHERE key = $1 AND user_id = $2 LIMIT 1`,
          [`ctrl:${idempotencyKey}`, userId]
        );
        if (existing.rows.length && existing.rows[0].response) {
          return res.json({ ...JSON.parse(existing.rows[0].response), idempotent: true });
        }
      } catch { /* non-fatal */ }
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles").select("kyc_status").eq("user_id", userId).single();
    if (profile?.kyc_status !== "verified") {
      return res.status(403).json({ success: false, error: "KYC_REQUIRED" });
    }

    // ── Per-user pending withdrawal cap ───────────────────────────────────────
    const MAX_PENDING_WITHDRAWALS = Number(process.env.MAX_PENDING_WITHDRAWALS || 3);
    const { count: pendingCount } = await supabaseAdmin
      .from("withdrawal_requests")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", ["pending", "processing"]);
    if ((pendingCount ?? 0) >= MAX_PENDING_WITHDRAWALS) {
      return res.status(429).json({ success: false, error: "TOO_MANY_PENDING_WITHDRAWALS" });
    }

    // ── Atomically debit wallet + create withdrawal_request (PENDING) ─────
    // Balance is locked here. The payout is dispatched asynchronously.
    const { data, error } = await supabaseAdmin.rpc("process_withdrawal", {
      p_amount: amount,
      p_payout_method_id: payoutMethodId || null,
      p_sender_id: userId,
    });
    if (error || !data) {
      return res.status(400).json({ success: false, error: error?.message || "WITHDRAWAL_FAILED" });
    }

    // ── Async payout dispatch (fraud re-check + provider call) ────────────
    // Fire-and-forget: the webhook will update the status when the provider responds.
    processWithdrawal(data.id).catch((err) => {
      logger.error("processWithdrawal background error", { id: data.id, error: err.message });
    });

    const responseBody = { success: true, withdrawal: data };

    if (idempotencyKey) {
      try {
        await db.query(
          `INSERT INTO idempotency_keys (key, user_id, response, created_at)
           VALUES ($1, $2, $3, NOW()) ON CONFLICT (key) DO NOTHING`,
          [`ctrl:${idempotencyKey}`, userId, JSON.stringify(responseBody)]
        );
      } catch { /* non-fatal */ }
    }

    return res.json(responseBody);
  } catch (err) {
    logger.error("requestWithdrawal error", { error: err.message });
    return next(err);
  }
}
