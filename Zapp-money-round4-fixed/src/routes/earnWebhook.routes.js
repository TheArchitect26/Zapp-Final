import express from "express";
import crypto from "crypto";
import { z } from "zod";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { logger } from "../lib/logger.js";
import { captureRawBody } from "../lib/rawBody.js";

const router = express.Router();

const SUPPORTED_PROVIDERS = ["pollfish", "adgate", "tapjoy"];

const bodySchema = z.object({
  user_id:        z.string().uuid(),
  opportunity_id: z.string().uuid(),
  transaction_id: z.string().optional(),
  status:         z.string(),
});

// POST /api/v1/webhooks/earn/:provider
router.post("/:provider", captureRawBody, async (req, res) => {
  const provider = req.params.provider.toLowerCase();

  if (!SUPPORTED_PROVIDERS.includes(provider)) {
    return res.json({ received: true });
  }

  // Verify HMAC-SHA256 — fail closed: no secret = reject (dev env may skip)
  const secret = process.env[`EARN_WEBHOOK_SECRET_${provider.toUpperCase()}`];
  if (!secret) {
    if (process.env.NODE_ENV === "development") {
      logger.warn("earn webhook: no secret configured (dev skip)", { provider });
    } else {
      logger.warn("earn webhook: no secret configured — rejecting", { provider });
      return res.json({ received: true });
    }
  } else {
    const signature = req.headers["x-webhook-signature"] || req.headers["x-signature"] || "";
    const expected = crypto.createHmac("sha256", secret).update(req.rawBody).digest("hex");
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    const valid =
      sigBuf.length === expBuf.length &&
      sigBuf.length > 0 &&
      crypto.timingSafeEqual(sigBuf, expBuf);
    if (!valid) {
      logger.warn("earn webhook: invalid signature", { provider });
      return res.json({ received: true });
    }
  }

  // Validate and sanitise body — rejects unknown/malformed user_id/opportunity_id
  const parsed = bodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    logger.warn("earn webhook: invalid body", { provider, issues: parsed.error.flatten() });
    return res.json({ received: true });
  }

  const { user_id, opportunity_id, transaction_id, status } = parsed.data;

  if (status !== "completed") return res.json({ received: true });

  // Idempotency — prefer transaction_id; fall back to (user_id, opportunity_id) composite key
  const idempotencyFilter = transaction_id
    ? supabaseAdmin.from("earn_completions").select("id", { count: "exact", head: true }).eq("provider_transaction_id", transaction_id)
    : supabaseAdmin.from("earn_completions").select("id", { count: "exact", head: true }).eq("user_id", user_id).eq("opportunity_id", opportunity_id);

  const { count: existingCount } = await idempotencyFilter;
  if ((existingCount ?? 0) > 0) {
    logger.info("earn webhook: duplicate", { provider, transaction_id, user_id, opportunity_id });
    return res.json({ received: true, duplicate: true });
  }

  try {
    const { error } = await supabaseAdmin.rpc("complete_earn_opportunity", {
      p_opportunity_id: opportunity_id,
      p_user_id: user_id,
      p_provider_transaction_id: transaction_id ?? null,
    });
    if (error) throw error;

    await supabaseAdmin.from("admin_audit_log").insert({
      admin_id: null,
      action: "earn.provider_callback",
      target_id: user_id,
      metadata: { provider, opportunity_id, transaction_id },
    }).catch(() => {});

    logger.info("earn webhook: processed", { provider, user_id, opportunity_id });
  } catch (err) {
    logger.error("earn webhook: rpc error", { provider, error: err.message });
  }

  return res.json({ received: true });
});

export default router;
