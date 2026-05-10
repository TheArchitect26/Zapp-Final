/**
 * PAYSTACK PAYMENT INTEGRATION
 *
 * Endpoints:
 *  POST /api/v1/payments/paystack/initialize  — create a payment session
 *  GET  /api/v1/payments/paystack/verify/:ref — verify after redirect
 *
 * Webhook is handled in webhooks.routes.js (POST /api/v1/webhooks/paystack)
 * with HMAC-SHA512 signature verification.
 *
 * Security:
 *  - Wallet is only credited via the webhook (server-to-server), never via
 *    the verify endpoint. The verify endpoint is for UI feedback only.
 *  - Signature verification on every webhook call prevents fake credits.
 */

import { z } from "zod";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { logger } from "../lib/logger.js";
import { db } from "../db/index.js";

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE   = "https://api.paystack.co";
const FRONTEND_URL    = process.env.FRONTEND_URL || "http://localhost:5173";

const initSchema = z.object({
  amount: z.number().int().positive().min(1000).max(5_000_000, "Max R50,000 per deposit"), // kobo/cents
  currency: z.enum(["ZAR", "NGN", "GHS", "USD"]).default("ZAR"),
  email: z.string().email().optional(),
});

/**
 * POST /api/v1/payments/paystack/initialize
 * Creates a Paystack payment session and returns the authorization URL.
 */
export async function paystackInitialize(req, res, next) {
  try {
    if (!PAYSTACK_SECRET) {
      return res.status(503).json({ success: false, error: "PAYSTACK_NOT_CONFIGURED" });
    }

    const parsed = initSchema.safeParse({
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

    const { amount, currency, email } = parsed.data;
    const userId = req.user.id;

    // Idempotency
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

    // Resolve user email if not provided
    let userEmail = email;
    if (!userEmail) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("user_id", userId)
        .single();
      userEmail = profile?.email || `${userId}@zapp.internal`;
    }

    const reference = `zapp_${userId.slice(0, 8)}_${Date.now()}`;

    const paystackRes = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
      },
      body: JSON.stringify({
        email: userEmail,
        amount,           // in kobo/cents
        currency,
        reference,
        callback_url: `${FRONTEND_URL}/top-up/result`,
        metadata: { user_id: userId, source: "zapp_topup" },
      }),
    });

    const paystackData = await paystackRes.json();
    if (!paystackRes.ok || !paystackData.data?.authorization_url) {
      logger.error("Paystack initialize failed", { status: paystackRes.status, data: paystackData });
      return res.status(502).json({ success: false, error: "PAYMENT_PROVIDER_ERROR" });
    }

    // Record the pending topup
    await supabaseAdmin.from("topup_requests").insert({
      user_id: userId,
      amount: amount / 100,  // store in major currency unit
      merchant_transaction_id: reference,
      status: "pending",
      provider: "paystack",
    }).catch((err) => logger.warn("topup_requests insert failed", { error: err.message }));

    const responseBody = {
      success: true,
      authorizationUrl: paystackData.data.authorization_url,
      reference,
    };

    if (idempotencyKey) {
      await db.query(
        `INSERT INTO idempotency_keys (key, user_id, response, created_at)
         VALUES ($1, $2, $3, NOW()) ON CONFLICT (key) DO NOTHING`,
        [`ctrl:${idempotencyKey}`, userId, JSON.stringify(responseBody)]
      ).catch(() => {});
    }

    return res.json(responseBody);
  } catch (err) {
    logger.error("paystackInitialize error", { error: err.message });
    return next(err);
  }
}

/**
 * GET /api/v1/payments/paystack/verify/:reference
 * Verifies a Paystack transaction status for UI feedback.
 * NOTE: Does NOT credit the wallet — that is done exclusively via the webhook.
 */
export async function paystackVerify(req, res, next) {
  try {
    if (!PAYSTACK_SECRET) {
      return res.status(503).json({ success: false, error: "PAYSTACK_NOT_CONFIGURED" });
    }

    const { reference } = req.params;
    if (!reference || !/^[a-zA-Z0-9_-]+$/.test(reference)) {
      return res.status(400).json({ success: false, error: "INVALID_REFERENCE" });
    }

    const paystackRes = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
    });

    const paystackData = await paystackRes.json();
    if (!paystackRes.ok) {
      return res.status(502).json({ success: false, error: "VERIFICATION_FAILED" });
    }

    const txData = paystackData.data;
    const status = txData?.status;   // "success" | "failed" | "pending"

    // Check our own record to confirm the webhook already processed it
    const { data: topup } = await supabaseAdmin
      .from("topup_requests")
      .select("status, amount")
      .eq("merchant_transaction_id", reference)
      .eq("user_id", req.user.id)
      .single();

    return res.json({
      success: true,
      status,
      amount: txData?.amount ? txData.amount / 100 : null,
      currency: txData?.currency,
      credited: topup?.status === "completed",
    });
  } catch (err) {
    logger.error("paystackVerify error", { error: err.message });
    return next(err);
  }
}
