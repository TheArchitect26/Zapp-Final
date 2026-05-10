import express from "express";
import crypto from "crypto";
import { db } from "../db/index.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { logger } from "../lib/logger.js";
import { captureRawBody } from "../lib/rawBody.js";

const router = express.Router();

function verifyWebhookSignature(req, res, next) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "development") {
      logger.warn("WEBHOOK_SECRET not set — skipping signature check (dev only)");
      return next();
    }
    return res.status(500).json({ success: false, error: "WEBHOOK_NOT_CONFIGURED" });
  }
  const signature = req.headers["x-webhook-signature"] || "";
  const expected = crypto.createHmac("sha256", secret).update(req.rawBody).digest("hex");

  const sigBuffer      = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    sigBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    logger.warn("Webhook signature mismatch");
    return res.status(401).json({ success: false, error: "INVALID_WEBHOOK_SIGNATURE" });
  }

  next();
}

/** DB-backed idempotency — survives restarts. Returns true if already processed. */
async function checkAndMarkProcessed(eventId) {
  try {
    const result = await db.query(
      `INSERT INTO webhook_events (event_id, processed_at)
       VALUES ($1, NOW())
       ON CONFLICT (event_id) DO NOTHING`,
      [eventId]
    );
    return result.rowCount === 0; // 0 = conflict = already processed
  } catch {
    // If table doesn't exist yet, fall through (non-fatal)
    return false;
  }
}

// ── Webhook handlers ──────────────────────────────────────────────────────────

async function handlePaymentConfirmed(data) {
  const { user_id, amount, currency = "ZAR", reference } = data ?? {};
  if (!user_id || !amount) throw new Error("payment.confirmed: missing user_id or amount");

  const { error } = await supabaseAdmin.rpc("credit_wallet", {
    p_user_id:   user_id,
    p_amount:    Number(amount),
    p_currency:  currency,
    p_reference: reference || null,
  });
  if (error) throw new Error(`credit_wallet failed: ${error.message}`);
}

async function handleKycApproved(data) {
  const { user_id } = data ?? {};
  if (!user_id) throw new Error("kyc.approved: missing user_id");

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ kyc_status: "verified", kyc_verified_at: new Date().toISOString() })
    .eq("user_id", user_id);
  if (error) throw new Error(`kyc.approved update failed: ${error.message}`);
}

async function handleKycRejected(data) {
  const { user_id, reason } = data ?? {};
  if (!user_id) throw new Error("kyc.rejected: missing user_id");

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ kyc_status: "rejected", kyc_rejection_reason: reason || null })
    .eq("user_id", user_id);
  if (error) throw new Error(`kyc.rejected update failed: ${error.message}`);
}

async function handleWithdrawalPaid(data) {
  const { withdrawal_id } = data ?? {};
  if (!withdrawal_id) throw new Error("withdrawal.paid: missing withdrawal_id");

  const { error } = await supabaseAdmin
    .from("withdrawal_requests")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", withdrawal_id);
  if (error) throw new Error(`withdrawal.paid update failed: ${error.message}`);
}

async function handleWithdrawalFailed(data) {
  const { withdrawal_id } = data ?? {};
  if (!withdrawal_id) {
    throw new Error("withdrawal.failed: missing withdrawal_id");
  }

  // RPC derives user_id, amount, currency from the withdrawal_requests row — no caller-supplied values needed
  const { error } = await supabaseAdmin.rpc("reverse_withdrawal", {
    p_withdrawal_id: withdrawal_id,
  });
  if (error) throw new Error(`reverse_withdrawal failed: ${error.message}`);
}

// ── Route ─────────────────────────────────────────────────────────────────────

router.post("/webhook", captureRawBody, verifyWebhookSignature, async (req, res) => {
  const { type, id: eventId, data } = req.body ?? {};

  if (eventId) {
    const duplicate = await checkAndMarkProcessed(eventId);
    if (duplicate) return res.json({ received: true, duplicate: true });
  }

  logger.info("Webhook received", { type, eventId });

  try {
    switch (type) {
      case "payment.confirmed":   await handlePaymentConfirmed(data);  break;
      case "kyc.approved":        await handleKycApproved(data);       break;
      case "kyc.rejected":        await handleKycRejected(data);       break;
      case "withdrawal.paid":     await handleWithdrawalPaid(data);    break;
      case "withdrawal.failed":   await handleWithdrawalFailed(data);  break;
      default:
        logger.warn("Unhandled webhook type", { type });
    }
  } catch (err) {
    logger.error("Webhook handler error", { type, error: err.message });
    // Permanent payload errors (missing fields) → 400 so provider doesn't retry forever.
    // Transient errors (DB down, RPC failed) → 500 so provider retries.
    const isPermanent = err.message.includes("missing");
    return res.status(isPermanent ? 400 : 500).json({ received: false, error: err.message });
  }

  res.json({ received: true, type });
});

/** Verifies Peach Payments webhook using PEACH_WEBHOOK_SECRET (HMAC-SHA256 on raw body). */
function verifyPeachSignature(req, res, next) {
  const secret = process.env.PEACH_WEBHOOK_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "development") return next();
    return res.status(500).json({ success: false, error: "PEACH_WEBHOOK_NOT_CONFIGURED" });
  }
  const signature = req.headers["x-peach-signature"] || req.headers["x-signature"] || "";
  const expected = crypto.createHmac("sha256", secret).update(req.rawBody).digest("hex");
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    logger.warn("Peach webhook signature mismatch");
    return res.status(401).json({ success: false, error: "INVALID_PEACH_SIGNATURE" });
  }
  next();
}

// ── Peach Payments top-up webhook ────────────────────────────────────────────
router.post("/peach", captureRawBody, verifyPeachSignature, async (req, res) => {
  const { result, merchantTransactionId, customParameters } = req.body ?? {};
  const code = result?.code || "";

  if (merchantTransactionId) {
    // Atomically claim the pending record — prevents double-credit on retried webhooks
    const claimed = await db.query(
      `UPDATE topup_requests SET status = $1, updated_at = NOW()
       WHERE merchant_transaction_id = $2 AND status = 'pending'
       RETURNING id, user_id, amount`,
      [code.startsWith("000") ? "completed" : "failed", merchantTransactionId]
    ).catch(() => ({ rows: [] }));

    const topup = claimed.rows[0];
    if (topup && code.startsWith("000")) {
      const userId = topup.user_id;
      if (!userId) {
        logger.error("Peach top-up: no user_id on topup_requests row", { merchantTransactionId });
      } else {
        await supabaseAdmin.rpc("top_up_wallet", { p_amount: topup.amount, p_user_id: userId });
        await supabaseAdmin.from("notifications").insert({ user_id: userId, title: "Top-Up Successful", message: `R${topup.amount} added to your wallet`, type: "topup" });
      }
    }
  }
  res.json({ received: true });
});

// ── Peach Payments payout webhook ────────────────────────────────────────────
router.post("/peach-payout", captureRawBody, verifyPeachSignature, async (req, res) => {
  const { result, merchantTransactionId } = req.body ?? {};
  const code = result?.code || "";

  if (merchantTransactionId) {
    const newStatus = code.startsWith("000") ? "paid" : "failed";
    const claimed = await db.query(
      `UPDATE withdrawal_requests SET status = $1, updated_at = NOW()
       WHERE id = $2 AND status = 'processing'
       RETURNING id, user_id, net_amount`,
      [newStatus, merchantTransactionId]
    ).catch(() => ({ rows: [] }));

    const wr = claimed.rows[0];
    if (wr) {
      if (code.startsWith("000")) {
        await supabaseAdmin.from("notifications").insert({ user_id: wr.user_id, title: "Withdrawal Paid", message: `Your R${wr.net_amount} withdrawal has been paid`, type: "withdrawal" });
      } else {
        await supabaseAdmin.rpc("reverse_withdrawal", { p_withdrawal_id: wr.id });
        await supabaseAdmin.from("notifications").insert({ user_id: wr.user_id, title: "Withdrawal Failed", message: `Your R${wr.net_amount} withdrawal failed and has been reversed to your wallet`, type: "withdrawal" });
      }
    }
  }
  res.json({ received: true });
});

// ── Smile Identity KYC webhook ────────────────────────────────────────────────
// Registered here (before express.json()) so captureRawBody can read raw bytes for HMAC.
import { handleSmileWebhook } from "../controllers/kyc.controller.js";
router.post("/smile", captureRawBody, handleSmileWebhook);

// ── Paystack webhook ──────────────────────────────────────────────────────────
// Paystack uses HMAC-SHA512 with the secret key as the signing key.
function verifyPaystackSignature(req, res, next) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === "development") return next();
    return res.status(500).json({ success: false, error: "PAYSTACK_NOT_CONFIGURED" });
  }
  const signature = req.headers["x-paystack-signature"] || "";
  const expected = crypto.createHmac("sha512", secret).update(req.rawBody).digest("hex");
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    logger.warn("Paystack webhook signature mismatch");
    return res.status(401).json({ success: false, error: "INVALID_PAYSTACK_SIGNATURE" });
  }
  next();
}

router.post("/paystack", captureRawBody, verifyPaystackSignature, async (req, res) => {
  const { event, data } = req.body ?? {};

  // Idempotency
  const eventId = data?.id ? `paystack_${data.id}` : null;
  if (eventId) {
    const duplicate = await checkAndMarkProcessed(eventId);
    if (duplicate) return res.json({ received: true, duplicate: true });
  }

  logger.info("Paystack webhook received", { event, reference: data?.reference });

  try {
    if (event === "charge.success") {
      const { reference, amount, currency, metadata } = data ?? {};
      const userId = metadata?.user_id;

      if (!userId || !amount || !reference) {
        return res.status(400).json({ received: false, error: "Missing required fields" });
      }

      // Atomically claim the pending record — prevents double-credit on retried webhooks
      const claimed = await db.query(
        `UPDATE topup_requests SET status = $1, updated_at = NOW()
         WHERE merchant_transaction_id = $2 AND status = 'pending'
         RETURNING id, user_id, amount`,
        ["completed", reference]
      ).catch(() => ({ rows: [] }));

      const topup = claimed.rows[0];
      if (topup) {
        const amountMajor = amount / 100;  // convert from kobo/cents
        await supabaseAdmin.rpc("top_up_wallet", {
          p_amount: amountMajor,
          p_user_id: userId,
        });
        await supabaseAdmin.from("notifications").insert({
          user_id: userId,
          title: "Top-Up Successful",
          message: `${currency} ${amountMajor.toFixed(2)} added to your wallet`,
          type: "topup",
        });
        logger.info("Paystack deposit credited", { userId, amount: amountMajor, reference });
      }
    }
  } catch (err) {
    logger.error("Paystack webhook handler error", { event, error: err.message });
    return res.status(500).json({ received: false, error: err.message });
  }

  res.json({ received: true, event });
});

export default router;

