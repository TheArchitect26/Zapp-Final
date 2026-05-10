import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { logger } from "../lib/logger.js";

const SMILE_BASE = "https://testapi.smileidentity.com/v1";
const SMILE_PARTNER_ID = process.env.SMILE_PARTNER_ID;
const SMILE_API_KEY = process.env.SMILE_API_KEY;

export async function initiateKYC(req, res, next) {
  try {
    const { id_number, first_name, last_name } = req.body;
    const userId = req.user.id;

    if (!id_number || !first_name || !last_name) {
      return res.status(400).json({ success: false, error: "id_number, first_name and last_name are required" });
    }
    if (!/^\d{13}$/.test(id_number)) {
      return res.status(400).json({ success: false, error: "Invalid SA ID number" });
    }

    // Sanitize name fields: letters, spaces, hyphens only; max 50 chars each
    const nameRe = /^[a-zA-Z\s'-]{1,50}$/;
    const safeName = (v) => String(v).trim();
    if (!nameRe.test(safeName(first_name)) || !nameRe.test(safeName(last_name))) {
      return res.status(400).json({ success: false, error: "Invalid name format" });
    }
    const safeFirst = safeName(first_name);
    const safeLast  = safeName(last_name);

    const { data: profile } = await supabaseAdmin
      .from("profiles").select("kyc_status").eq("user_id", userId).single();
    if (profile?.kyc_status === "verified") {
      return res.status(409).json({ success: false, error: "Already verified" });
    }
    if (profile?.kyc_status === "pending") {
      return res.status(409).json({ success: false, error: "KYC already in progress" });
    }

    // Build HMAC signature — api_key is used for signing only, never sent in body
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac("sha256", SMILE_API_KEY || "")
      .update(`${SMILE_PARTNER_ID}:${timestamp}`)
      .digest("base64");

    const smileRes = await fetch(`${SMILE_BASE}/id_verification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Smile-Partner-ID": SMILE_PARTNER_ID,
        "X-Smile-Timestamp": timestamp,
        "X-Smile-Signature": signature,
      },
      body: JSON.stringify({
        partner_id: SMILE_PARTNER_ID,
        id_type: "NATIONAL_ID",
        country: "ZA",
        id_number,
        first_name: safeFirst,
        last_name: safeLast,
        callback_url: process.env.SMILE_CALLBACK_URL,
      }),
    });

    const smileData = await smileRes.json();
    const jobId = smileData.SmileJobID || smileData.job_id || null;

    await supabaseAdmin.from("kyc_submissions").insert({
      user_id: userId,
      smile_job_id: jobId,
      id_number_last4: id_number.slice(-4),
      status: "pending",
    });

    await supabaseAdmin.from("profiles")
      .update({ kyc_status: "pending" }).eq("user_id", userId);

    return res.json({ success: true, submitted: true, jobId });
  } catch (err) { return next(err); }
}

export async function handleSmileWebhook(req, res, next) {
  try {
    // Verify Smile webhook signature — fail closed if secret not configured
    const signature = req.headers["x-smile-signature"] || "";
    const timestamp = req.headers["x-smile-timestamp"] || "";
    if (!SMILE_API_KEY) {
      return res.status(500).json({ received: false, error: "SMILE_WEBHOOK_NOT_CONFIGURED" });
    }
    const expected = createHmac("sha256", SMILE_API_KEY)
      .update(`${SMILE_PARTNER_ID}:${timestamp}`)
      .digest("base64");
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return res.status(401).json({ received: false, error: "INVALID_SIGNATURE" });
    }

    const { SmileJobID, ResultCode, ResultText } = req.body ?? {};

    const { data: submission } = await supabaseAdmin
      .from("kyc_submissions").select("*").eq("smile_job_id", SmileJobID).single();

    if (!submission) return res.json({ received: true });

    const verified = ResultCode === "1020";
    const newStatus = verified ? "verified" : "failed";
    const failureReason = verified ? null : (ResultText || "Verification failed");

    await supabaseAdmin.from("kyc_submissions")
      .update({ status: newStatus, failure_reason: failureReason, updated_at: new Date().toISOString() })
      .eq("id", submission.id);

    await supabaseAdmin.from("profiles")
      .update({ kyc_status: verified ? "verified" : "rejected" })
      .eq("user_id", submission.user_id);

    await supabaseAdmin.from("admin_audit_log").insert({
      action: verified ? "kyc_auto_verified" : "kyc_auto_failed",
      admin_id: null,
      target_id: submission.user_id,
      metadata: { reason: failureReason },
      created_at: new Date().toISOString(),
    });

    await supabaseAdmin.from("notifications").insert({
      user_id: submission.user_id,
      title: verified ? "Identity Verified" : "Verification Failed",
      message: verified
        ? "Your identity has been verified. Withdrawals are now unlocked."
        : `Verification failed: ${failureReason}. Please try again.`,
      type: "kyc",
    });

    return res.json({ received: true });
  } catch (err) { return next(err); }
}
