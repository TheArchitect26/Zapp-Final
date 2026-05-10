import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { learnFraud } from "../services/fraudAI.service.js";
import { runFraudPipeline } from "../fraud/fraudPipeline.js";
import { z } from "zod";
import { db } from "../db/index.js";
import { logger } from "../lib/logger.js";

const sendMoneySchema = z.object({
  senderId: z.string().uuid("senderId must be a UUID"),
  recipientUsername: z.string().min(2).max(50).regex(/^[a-zA-Z0-9_.-]+$/, "Invalid username"),
  amount: z.number().positive().max(100_000, "Amount exceeds single-transaction limit"),
  message: z.string().max(200).optional(),
});

function defaultDecision() {
  return { rail: "WALLET", confidence: 0 };
}

/** DB-backed idempotency for transfers. Returns cached result if key already used. */
async function checkTransferIdempotency(idempotencyKey, userId) {
  if (!idempotencyKey) return null;
  try {
    const result = await db.query(
      `SELECT response FROM idempotency_keys
       WHERE key = $1 AND user_id = $2 LIMIT 1`,
      [`ctrl:${idempotencyKey}`, userId]
    );
    if (result.rows.length && result.rows[0].response) {
      return JSON.parse(result.rows[0].response);
    }
  } catch { /* table may not exist yet */ }
  return null;
}

async function storeTransferIdempotency(idempotencyKey, userId, response) {
  if (!idempotencyKey) return;
  try {
    await db.query(
      `INSERT INTO idempotency_keys (key, user_id, response, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (key) DO NOTHING`,
      [`ctrl:${idempotencyKey}`, userId, JSON.stringify(response)]
    );
  } catch { /* non-fatal */ }
}

export async function sendMoney(req, res, next) {
  try {
    // ── Input validation ──────────────────────────────────────────────────
    const parsed = sendMoneySchema.safeParse({
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

    const { senderId, recipientUsername, amount, message } = parsed.data;

    // ── Ownership check ───────────────────────────────────────────────────
    if (senderId !== req.user?.id) {
      return res.status(403).json({ success: false, error: "SENDER_MISMATCH" });
    }

    // ── Idempotency ───────────────────────────────────────────────────────
    const idempotencyKey = req.headers["idempotency-key"] || null;
    if (idempotencyKey) {
      const cached = await checkTransferIdempotency(idempotencyKey, senderId);
      if (cached) return res.json({ ...cached, idempotent: true });
    }

    const numericAmount = amount;

    const { data: sender } = await supabaseAdmin.from("wallets").select("*").eq("user_id", senderId).single();

    const { data: receiverProfile } = await supabaseAdmin
      .from("profiles").select("user_id").eq("username", recipientUsername).single();

    if (!receiverProfile?.user_id) {
      return res.status(404).json({ success: false, error: "RECIPIENT_NOT_FOUND" });
    }

    const { data: receiver } = await supabaseAdmin.from("wallets").select("*").eq("user_id", receiverProfile.user_id).single();

    if (!sender || !receiver) {
      return res.status(404).json({ success: false, error: "WALLET_NOT_FOUND" });
    }
    if (Number(sender.balance) < numericAmount) {
      return res.status(400).json({ success: false, error: "INSUFFICIENT_BALANCE" });
    }

    // ── KYC gate ──────────────────────────────────────────────────────────
    const { data: profile } = await supabaseAdmin
      .from("profiles").select("kyc_status").eq("user_id", senderId).single();
    if (profile?.kyc_status !== "verified") {
      return res.status(403).json({ success: false, error: "KYC_REQUIRED" });
    }

    // ── Fraud gate ────────────────────────────────────────────────────────
    const fraudResult = await runFraudPipeline({
      amount: numericAmount,
      entityId: senderId,
      velocity: 1,
    });
    const risk = fraudResult.finalScore;
    const riskLevel = fraudResult.decision.level;

    if (fraudResult.enforcement === "BLOCK" || fraudResult.enforcement === "REVIEW") {
      await learnFraud({ entityId: senderId, amount: numericAmount, risk, outcome: "declined" });
      return res.status(403).json({ success: false, status: "DECLINED_FRAUD_AI", risk, riskLevel });
    }

    // ── ML routing (optional, 2s timeout) ────────────────────────────────
    let mlDecision = defaultDecision();
    if (process.env.ML_API_URL) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        const mlResponse = await fetch(`${process.env.ML_API_URL}/predict`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: numericAmount,
            user_trust: sender.trust_score || 0.5,
            tx_count: sender.tx_count || 1,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (mlResponse.ok) {
          const payload = await mlResponse.json();
          mlDecision = { rail: payload?.rail || "WALLET", confidence: Number(payload?.confidence || 0) };
        }
      } catch { /* ML unavailable — fall back to WALLET rail */ }
    }

    const selectedRail = mlDecision.confidence > 0.7 ? mlDecision.rail : "WALLET";

    const { data: transferResult, error: transferError } = await supabaseAdmin.rpc("transfer_funds", {
      p_recipient_username: recipientUsername,
      p_amount: numericAmount,
      p_message: String(message || "").slice(0, 200),
      p_sender_id: senderId,
    });

    if (transferError || !transferResult?.success) {
      return res.status(400).json({
        success: false,
        error: transferResult?.error || transferError?.message || "TRANSFER_FAILED",
      });
    }

    await learnFraud({ entityId: senderId, amount: numericAmount, risk, outcome: "approved" });
    await supabaseAdmin.from("ai_telemetry").insert({
      rail_used: selectedRail, amount: numericAmount, success: true, latency: 200, cost: 0,
    }).then(() => {}).catch(() => {});

    const responseBody = {
      success: true,
      decision: { rail: selectedRail, confidence: mlDecision.confidence },
      transfer: transferResult,
    };

    await storeTransferIdempotency(idempotencyKey, senderId, responseBody);

    return res.json(responseBody);
  } catch (error) {
    logger.error("sendMoney error", { error: error.message });
    return next(error);
  }
}
