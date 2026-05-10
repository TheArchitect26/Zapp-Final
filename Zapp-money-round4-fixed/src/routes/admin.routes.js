import express from "express";
import { z } from "zod";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { invalidateRateCache } from "../services/coinRate.service.js";

const router = express.Router();

// GET /api/v1/admin/audit-log
// Returns last 200 admin actions
router.get("/audit-log", async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("admin_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return res.json({ success: true, log: data });
  } catch (err) {
    return next(err);
  }
});

// POST /api/v1/admin/kyc
// Body: { userId: string, status: "verified" | "rejected", reason?: string }
router.post("/kyc", async (req, res, next) => {
  try {
    const { userId, status, reason } = req.body ?? {};
    if (!userId || !["verified", "rejected"].includes(status)) {
      return res.status(400).json({ success: false, error: "INVALID_INPUT" });
    }
    // Sanitize reason: plain string, max 500 chars
    const safeReason = reason ? String(reason).slice(0, 500) : null;

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ kyc_status: status })
      .eq("user_id", userId);
    if (error) throw error;

    // Notification to user
    const title   = status === "verified" ? "Identity Verified" : "Verification Rejected";
    const message = status === "verified"
      ? "Your identity has been verified. You can now make withdrawals."
      : `Your verification was rejected. ${safeReason || "Please resubmit your documents."}`;

    await supabaseAdmin.from("notifications").insert({
      user_id: userId, title, message, type: "kyc",
    });

    // Audit log
    await supabaseAdmin.from("admin_audit_log").insert({
      admin_id:  req.user.id,
      action:    `kyc.${status}`,
      target_id: userId,
      metadata:  { reason: safeReason },
    });

    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

// GET /api/v1/admin/coin-rates
router.get("/coin-rates", async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("coin_exchange_rates")
      .select("*")
      .order("currency_code");
    if (error) throw error;
    return res.json({ success: true, rates: data });
  } catch (err) { return next(err); }
});

const rateSchema = z.object({
  zc_per_unit:       z.number().positive(),
  min_withdrawal_zc: z.number().int().positive().optional(),
  symbol:            z.string().min(1).max(5).optional(),
  display_decimals:  z.number().int().min(0).max(6).optional(),
  active:            z.boolean().optional(),
});

// PUT /api/v1/admin/coin-rates/:currency_code
router.put("/coin-rates/:currency_code", async (req, res, next) => {
  try {
    const currencyCode = req.params.currency_code.toUpperCase();
    const parsed = rateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: "INVALID_INPUT", details: parsed.error.flatten() });
    }

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("coin_exchange_rates").select("*").eq("currency_code", currencyCode).single();
    if (fetchErr || !existing) return res.status(404).json({ success: false, error: "RATE_NOT_FOUND" });

    const updates = { ...parsed.data, updated_at: new Date().toISOString() };
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("coin_exchange_rates").update(updates).eq("currency_code", currencyCode).select().single();
    if (updateErr) throw updateErr;

    invalidateRateCache(currencyCode);

    await supabaseAdmin.from("admin_audit_log").insert({
      admin_id: req.user.id,
      action: "coin_rate.updated",
      target_id: currencyCode,
      metadata: { currency_code: currencyCode, old_rate: existing.zc_per_unit, new_rate: parsed.data.zc_per_unit },
    }).catch(() => {});

    return res.json({ success: true, rate: updated });
  } catch (err) { return next(err); }
});

export default router;

