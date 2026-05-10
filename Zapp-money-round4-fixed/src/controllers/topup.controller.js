import { randomUUID } from "crypto";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { logger } from "../lib/logger.js";

const PEACH_BASE = process.env.PEACH_PAYMENTS_BASE_URL || "https://testopenapi.peachpayments.com";
const PEACH_KEY = process.env.PEACH_PAYMENTS_API_KEY;
const PEACH_ENTITY = process.env.PEACH_PAYMENTS_ENTITY_ID;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";

export async function createCheckout(req, res, next) {
  try {
    const amount = Number(req.body.amount);
    if (!amount || amount < 10 || amount > 50000) {
      return res.status(400).json({ success: false, error: "INVALID_AMOUNT" });
    }

    // Idempotency: require caller-supplied key — never generate server-side
    const idempotencyKey = req.headers["idempotency-key"];
    if (!idempotencyKey) {
      return res.status(400).json({ success: false, error: "Idempotency-Key header is required" });
    }

    // Check for existing pending topup with same idempotency key
    const { data: existing } = await supabaseAdmin
      .from("topup_requests")
      .select("merchant_transaction_id, status")
      .eq("idempotency_key", idempotencyKey)
      .eq("user_id", req.user.id)
      .single();

    if (existing?.merchant_transaction_id) {
      // Return the existing checkout URL if still pending
      return res.json({
        success: true,
        checkoutUrl: `${FRONTEND_URL}/top-up/result?ref=${existing.merchant_transaction_id}`,
        idempotent: true,
      });
    }

    const merchantTransactionId = randomUUID();

    const peachRes = await fetch(`${PEACH_BASE}/v2/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PEACH_KEY}`,
      },
      body: JSON.stringify({
        authentication: { entityId: PEACH_ENTITY },
        amount: amount.toFixed(2),
        currency: "ZAR",
        paymentType: "DB",
        merchantTransactionId,
        shopperResultUrl: `${FRONTEND_URL}/top-up/result`,
        notificationUrl: `${BACKEND_URL}/api/v1/webhooks/peach`,
        customParameters: { userId: req.user.id },
      }),
    });

    const peachData = await peachRes.json();
    if (!peachRes.ok || !peachData.url) {
      logger.error("Peach checkout failed", { status: peachRes.status, body: peachData });
      return res.status(502).json({ success: false, error: "Payment provider unavailable" });
    }

    const { error: insertError } = await supabaseAdmin.from("topup_requests").upsert({
      user_id: req.user.id,
      amount,
      merchant_transaction_id: merchantTransactionId,
      peach_checkout_id: peachData.id || null,
      idempotency_key: idempotencyKey,
      status: "pending",
    }, { onConflict: "merchant_transaction_id", ignoreDuplicates: true });
    if (insertError) {
      logger.error("topup_requests upsert failed", { error: insertError.message });
      return res.status(500).json({ success: false, error: "TOPUP_RECORD_FAILED" });
    }

    return res.json({ success: true, checkoutUrl: peachData.url });
  } catch (err) { return next(err); }
}
