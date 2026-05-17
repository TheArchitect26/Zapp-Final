import express from "express";
import { randomUUID } from "crypto";
import {
  requestToPay, getCollectionStatus,
  transfer, getTransferStatus,
  deposit, getDepositStatus,
  refund, getRefundStatus,
  getDisbursementBalance, validateAccount,
} from "../services/momo.service.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { logger } from "../lib/logger.js";

const router = express.Router();

// ── Collections ───────────────────────────────────────────────────────────────

router.post("/topup", async (req, res) => {
  const { amount, currency = "EUR", phone } = req.body;
  if (!amount || !phone) return res.status(400).json({ success: false, error: "amount and phone required" });

  const externalId = randomUUID();
  try {
    const referenceId = await requestToPay({ amount, currency, phone, externalId });
    await supabaseAdmin.from("topup_requests").insert({
      user_id: req.user.id,
      amount,
      currency,
      merchant_transaction_id: externalId,
      provider: "momo",
      provider_ref: referenceId,
      status: "pending",
    });
    return res.status(202).json({ success: true, referenceId, externalId });
  } catch (err) {
    logger.error("MoMo topup", { message: err.message });
    return res.status(502).json({ success: false, error: err.message });
  }
});

router.get("/topup/:ref", async (req, res) => {
  try {
    return res.json({ success: true, ...(await getCollectionStatus(req.params.ref)) });
  } catch (err) {
    return res.status(502).json({ success: false, error: err.message });
  }
});

// ── Disbursements — Transfer (payout) ─────────────────────────────────────────

router.post("/transfer", async (req, res) => {
  const { amount, currency = "EUR", phone } = req.body;
  if (!amount || !phone) return res.status(400).json({ success: false, error: "amount and phone required" });

  try {
    const referenceId = await transfer({ amount, currency, phone, externalId: randomUUID() });
    return res.status(202).json({ success: true, referenceId });
  } catch (err) {
    logger.error("MoMo transfer", { message: err.message });
    return res.status(502).json({ success: false, error: err.message });
  }
});

router.get("/transfer/:ref", async (req, res) => {
  try {
    return res.json({ success: true, ...(await getTransferStatus(req.params.ref)) });
  } catch (err) {
    return res.status(502).json({ success: false, error: err.message });
  }
});

// ── Disbursements — Deposit ───────────────────────────────────────────────────

router.post("/deposit", async (req, res) => {
  const { amount, currency = "EUR", phone } = req.body;
  if (!amount || !phone) return res.status(400).json({ success: false, error: "amount and phone required" });

  try {
    const referenceId = await deposit({ amount, currency, phone, externalId: randomUUID() });
    return res.status(202).json({ success: true, referenceId });
  } catch (err) {
    logger.error("MoMo deposit", { message: err.message });
    return res.status(502).json({ success: false, error: err.message });
  }
});

router.get("/deposit/:ref", async (req, res) => {
  try {
    return res.json({ success: true, ...(await getDepositStatus(req.params.ref)) });
  } catch (err) {
    return res.status(502).json({ success: false, error: err.message });
  }
});

// ── Disbursements — Refund ────────────────────────────────────────────────────

router.post("/refund", async (req, res) => {
  const { amount, currency = "EUR", referenceIdToRefund } = req.body;
  if (!amount || !referenceIdToRefund) return res.status(400).json({ success: false, error: "amount and referenceIdToRefund required" });

  try {
    const referenceId = await refund({ amount, currency, externalId: randomUUID(), referenceIdToRefund });
    return res.status(202).json({ success: true, referenceId });
  } catch (err) {
    logger.error("MoMo refund", { message: err.message });
    return res.status(502).json({ success: false, error: err.message });
  }
});

router.get("/refund/:ref", async (req, res) => {
  try {
    return res.json({ success: true, ...(await getRefundStatus(req.params.ref)) });
  } catch (err) {
    return res.status(502).json({ success: false, error: err.message });
  }
});

// ── Utilities ─────────────────────────────────────────────────────────────────

router.get("/balance", async (_req, res) => {
  try {
    return res.json({ success: true, ...(await getDisbursementBalance()) });
  } catch (err) {
    return res.status(502).json({ success: false, error: err.message });
  }
});

router.get("/validate/:phone", async (req, res) => {
  try {
    const active = await validateAccount(req.params.phone);
    return res.json({ success: true, active });
  } catch (err) {
    return res.status(502).json({ success: false, error: err.message });
  }
});

export default router;
