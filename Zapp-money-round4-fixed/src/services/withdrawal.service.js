/**
 * WITHDRAWAL PROCESSOR
 *
 * Handles the async processing of withdrawal requests.
 * Status flow: PENDING → PROCESSING → SUCCESS | FAILED
 *
 * The balance is locked (deducted) atomically when the withdrawal is created
 * via the process_withdrawal RPC. This processor handles the payout leg.
 *
 * Fraud is re-checked before payout is dispatched to the payment provider.
 */

import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { logger } from "../lib/logger.js";
import { runFraudPipeline } from "../fraud/fraudPipeline.js";
import { eventBus } from "../events/eventBus.js";
import { EVENT_TYPES } from "../events/eventTypes.js";
import { getRate, getUserCurrency } from "../services/coinRate.service.js";

const PEACH_BASE = process.env.PEACH_PAYMENTS_BASE_URL || "https://testopenapi.peachpayments.com";
const PEACH_KEY = process.env.PEACH_PAYMENTS_API_KEY;
const PEACH_ENTITY = process.env.PEACH_PAYMENTS_ENTITY_ID;
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";

export const WITHDRAWAL_STATUS = Object.freeze({
  PENDING:    "pending",
  PROCESSING: "processing",
  SUCCESS:    "paid",
  FAILED:     "failed",
  REVERSED:   "reversed",
});

/**
 * Process a single pending withdrawal.
 * Called by the withdrawal worker or directly after creation.
 *
 * @param {string} withdrawalId
 * @returns {{ ok: boolean, status: string, reason?: string }}
 */
export async function processWithdrawal(withdrawalId) {
  // ── Fetch and lock the withdrawal record ─────────────────────────────────
  const { data: wr, error: fetchErr } = await supabaseAdmin
    .from("withdrawal_requests")
    .select("*")
    .eq("id", withdrawalId)
    .eq("status", WITHDRAWAL_STATUS.PENDING)
    .single();

  if (fetchErr || !wr) {
    logger.warn("processWithdrawal: record not found or not pending", { withdrawalId });
    return { ok: false, status: "NOT_FOUND_OR_NOT_PENDING" };
  }

  // ── Transition to PROCESSING (optimistic lock) ────────────────────────────
  const { error: lockErr, count } = await supabaseAdmin
    .from("withdrawal_requests")
    .update({ status: WITHDRAWAL_STATUS.PROCESSING, updated_at: new Date().toISOString() })
    .eq("id", withdrawalId)
    .eq("status", WITHDRAWAL_STATUS.PENDING);

  if (lockErr || count === 0) {
    logger.warn("processWithdrawal: failed to lock record (already claimed?)", { withdrawalId });
    return { ok: false, status: "LOCK_FAILED" };
  }

  try {
    // ── Fraud re-check before payout ────────────────────────────────────────
    const fraudResult = await runFraudPipeline({
      amount: Number(wr.amount),
      entityId: wr.user_id,
      velocity: 1,
      type: "withdrawal",
    });

    if (fraudResult.enforcement === "BLOCK") {
      logger.warn("processWithdrawal: fraud BLOCK on re-check", {
        withdrawalId,
        risk: fraudResult.finalScore,
      });

      // Reverse the balance deduction
      await supabaseAdmin.rpc("reverse_withdrawal", { p_withdrawal_id: withdrawalId });

      eventBus.emit(EVENT_TYPES.FRAUD_BLOCK_TRANSACTION, {
        transactionId: withdrawalId,
        entityId: wr.user_id,
        risk: fraudResult.finalScore,
        action: "WITHDRAWAL_BLOCKED",
      }, { transactionId: withdrawalId });

      return { ok: false, status: WITHDRAWAL_STATUS.FAILED, reason: "FRAUD_BLOCK" };
    }

    // ── Coin rate: minimum check + fiat conversion ──────────────────────────
    const currencyCode = await getUserCurrency(wr.user_id);
    const rate = await getRate(currencyCode);

    if (Number(wr.amount) < rate.min_withdrawal_zc) {
      logger.warn("processWithdrawal: below minimum ZC", { withdrawalId, amount: wr.amount, min: rate.min_withdrawal_zc });
      await supabaseAdmin.rpc("reverse_withdrawal", { p_withdrawal_id: withdrawalId });
      return { ok: false, status: WITHDRAWAL_STATUS.FAILED, reason: "BELOW_MINIMUM" };
    }

    // ── Fetch payout method ─────────────────────────────────────────────────
    let bankAccount = null;
    if (wr.payout_method_id) {
      const { data: pm } = await supabaseAdmin
        .from("payout_methods")
        .select("details")
        .eq("id", wr.payout_method_id)
        .single();
      if (pm?.details) {
        bankAccount = {
          bankName: pm.details.bank_name,
          accountNumber: pm.details.account_last4,
          accountType: "CURRENT",
        };
      }
    }

    // ── Dispatch to payment provider ────────────────────────────────────────
    if (bankAccount && PEACH_KEY) {
      // Convert ZC to fiat using the user's currency rate
      const netZc = wr.net_amount != null ? Number(wr.net_amount) : Math.round(Number(wr.amount) * 0.96);
      const fiatAmount = netZc / rate.zc_per_unit;
      const peachRes = await fetch(`${PEACH_BASE}/v2/payouts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${PEACH_KEY}`,
        },
        body: JSON.stringify({
          authentication: { entityId: PEACH_ENTITY },
          amount: fiatAmount.toFixed(2),
          currency: currencyCode,
          paymentType: "CT",
          bankAccount,
          merchantTransactionId: withdrawalId,
          notificationUrl: `${BACKEND_URL}/api/v1/webhooks/peach-payout`,
        }),
      });

      if (!peachRes.ok) {
        const body = await peachRes.text();
        logger.error("processWithdrawal: Peach payout failed", {
          withdrawalId,
          status: peachRes.status,
          body,
        });
        // Revert to PENDING so it can be retried
        await supabaseAdmin
          .from("withdrawal_requests")
          .update({ status: WITHDRAWAL_STATUS.PENDING, updated_at: new Date().toISOString() })
          .eq("id", withdrawalId);
        return { ok: false, status: WITHDRAWAL_STATUS.PENDING, reason: "PROVIDER_ERROR" };
      }

      logger.info("processWithdrawal: payout dispatched", { withdrawalId });
      return { ok: true, status: WITHDRAWAL_STATUS.PROCESSING };
    }

    // No bank account configured — mark as failed and reverse
    logger.warn("processWithdrawal: no payout method", { withdrawalId });
    await supabaseAdmin.rpc("reverse_withdrawal", { p_withdrawal_id: withdrawalId });
    return { ok: false, status: WITHDRAWAL_STATUS.FAILED, reason: "NO_PAYOUT_METHOD" };

  } catch (err) {
    logger.error("processWithdrawal: unexpected error", { withdrawalId, error: err.message });
    // Revert to PENDING for retry
    await supabaseAdmin
      .from("withdrawal_requests")
      .update({ status: WITHDRAWAL_STATUS.PENDING, updated_at: new Date().toISOString() })
      .eq("id", withdrawalId)
      .catch(() => {});
    return { ok: false, status: WITHDRAWAL_STATUS.PENDING, reason: err.message };
  }
}
