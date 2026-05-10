/**
 * TRANSACTION SAFETY GATE
 *
 * All four checks must pass before any settlement is allowed.
 * Called synchronously inside the DB transaction, after the row lock.
 *
 * Checks:
 *  1. Fraud decision (in-memory cache populated by synchronous FRAUD_BLOCK_TRANSACTION event)
 *  2. Balance (re-checked inside the locked row to prevent TOCTOU)
 *  3. Governance rules (daily volume, risk score, mode)
 *  4. Liquidity (amount does not exceed per-transaction cap)
 */

import { logger } from "../lib/logger.js";
import { getGovernanceMode, GOVERNANCE_MODE } from "../governance/governanceMode.js";
import { systemGovernor } from "../governance/systemGovernor.js";

const MAX_SINGLE_TX_AMOUNT = Number(process.env.MAX_SINGLE_TX_AMOUNT || 100_000);

/**
 * @param {object} job  - settlement_queue row (from_account, to_account, amount, currency, risk_metadata)
 * @param {Map}    fraudState - in-memory fraud cache from moneyEngine
 * @param {object} client - pg client (already inside BEGIN)
 * @returns {{ ok: boolean, reason: string }}
 */
export async function runTransactionGate(job, fraudState, client) {
  const transactionId = job.transaction_id;
  const amount = Number(job.amount);

  // ── 1. FRAUD CHECK ──────────────────────────────────────────────────────────
  const fraud = fraudState.get(transactionId);
  if (fraud?.decision === "BLOCK") {
    logger.warn("Gate: fraud BLOCK", { transactionId, risk: fraud.risk });
    return { ok: false, reason: "FRAUD_BLOCK" };
  }
  if (fraud?.decision === "REVIEW") {
    logger.warn("Gate: fraud REVIEW — holding for manual review", { transactionId });
    return { ok: false, reason: "FRAUD_REVIEW_HOLD" };
  }

  // Also check persisted risk_metadata (covers cases where in-memory cache was cold)
  const riskMeta = job.risk_metadata
    ? (typeof job.risk_metadata === "string" ? JSON.parse(job.risk_metadata) : job.risk_metadata)
    : {};
  if (riskMeta.fraudDecision === "BLOCK") {
    logger.warn("Gate: persisted fraud BLOCK", { transactionId });
    return { ok: false, reason: "FRAUD_BLOCK_PERSISTED" };
  }
  if (riskMeta.fraudDecision === "REVIEW") {
    logger.warn("Gate: persisted fraud REVIEW — holding for manual review", { transactionId });
    return { ok: false, reason: "FRAUD_REVIEW_HOLD_PERSISTED" };
  }

  // ── 2. BALANCE CHECK (inside lock) ─────────────────────────────────────────
  const balResult = await client.query(
    `SELECT COALESCE(SUM(
       CASE entry_type
         WHEN 'CREDIT' THEN amount
         WHEN 'DEBIT'  THEN -amount
         ELSE 0
       END
     ), 0) AS balance_cents
     FROM wallet_ledger
     WHERE user_id = $1 AND currency = $2`,
    [job.from_account, job.currency || "ZAR"]
  );
  const balanceCents = Number(balResult.rows[0]?.balance_cents || 0);
  const amountCents = Math.round(amount * 100);

  if (balanceCents < amountCents) {
    logger.warn("Gate: insufficient funds", { transactionId, balanceCents, amountCents });
    return { ok: false, reason: "INSUFFICIENT_FUNDS" };
  }

  // ── 3. GOVERNANCE CHECK ────────────────────────────────────────────────────
  const mode = await getGovernanceMode();
  if (mode === GOVERNANCE_MODE.FREEZE_ALL || mode === GOVERNANCE_MODE.READ_ONLY) {
    logger.warn("Gate: governance mode block", { transactionId, mode });
    return { ok: false, reason: `GOVERNANCE_MODE_BLOCK:${mode}` };
  }

  const risk = Number(riskMeta.risk || 0);
  const govResult = await systemGovernor.canExecute({ amount, risk, type: "settlement" });
  if (!govResult.ok) {
    logger.warn("Gate: governance rule block", { transactionId, reason: govResult.reason });
    return { ok: false, reason: `GOVERNANCE_RULE:${govResult.reason}` };
  }

  // ── 4. LIQUIDITY / SINGLE-TX CAP ──────────────────────────────────────────
  if (amount > MAX_SINGLE_TX_AMOUNT) {
    logger.warn("Gate: single-tx cap exceeded", { transactionId, amount, cap: MAX_SINGLE_TX_AMOUNT });
    return { ok: false, reason: "SINGLE_TX_CAP_EXCEEDED" };
  }

  return { ok: true, reason: "PASS" };
}
