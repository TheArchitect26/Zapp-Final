/**
 * FINANCIAL AUDIT LOGGER
 *
 * Structured logging for all money-movement events.
 * Writes to both the application logger (stdout) and the audit_log table.
 *
 * All financial events must be logged here — no silent failures.
 */

import { logger } from "./logger.js";
import { supabaseAdmin } from "./supabaseAdmin.js";

const AUDIT_TYPES = Object.freeze({
  TRANSACTION_CREATED:   "transaction.created",
  TRANSACTION_SETTLED:   "transaction.settled",
  TRANSACTION_FAILED:    "transaction.failed",
  FRAUD_BLOCK:           "fraud.block",
  FRAUD_REVIEW:          "fraud.review",
  WITHDRAWAL_CREATED:    "withdrawal.created",
  WITHDRAWAL_PROCESSED:  "withdrawal.processed",
  WITHDRAWAL_FAILED:     "withdrawal.failed",
  WITHDRAWAL_REVERSED:   "withdrawal.reversed",
  DEPOSIT_CREDITED:      "deposit.credited",
  WALLET_RECONCILIATION: "wallet.reconciliation",
});

/**
 * Write a structured audit log entry.
 * Never throws — logs to stderr if DB write fails.
 */
async function writeAuditLog(type, userId, data = {}) {
  const entry = {
    type,
    user_id: userId || null,
    data,
    created_at: new Date().toISOString(),
  };

  // Always log to stdout
  logger.info(`AUDIT:${type}`, { userId, ...data });

  // Persist to DB (non-blocking, non-fatal)
  supabaseAdmin
    .from("audit_log")
    .insert(entry)
    .then(({ error }) => {
      if (error) {
        logger.error("audit_log insert failed", { type, error: error.message });
      }
    })
    .catch((err) => {
      logger.error("audit_log insert threw", { type, error: err.message });
    });
}

export const auditLog = {
  transactionCreated: (userId, txId, amount, currency) =>
    writeAuditLog(AUDIT_TYPES.TRANSACTION_CREATED, userId, { txId, amount, currency }),

  transactionSettled: (userId, txId, amount, currency) =>
    writeAuditLog(AUDIT_TYPES.TRANSACTION_SETTLED, userId, { txId, amount, currency }),

  transactionFailed: (userId, txId, reason) =>
    writeAuditLog(AUDIT_TYPES.TRANSACTION_FAILED, userId, { txId, reason }),

  fraudBlock: (userId, txId, risk, reason) =>
    writeAuditLog(AUDIT_TYPES.FRAUD_BLOCK, userId, { txId, risk, reason }),

  fraudReview: (userId, txId, risk) =>
    writeAuditLog(AUDIT_TYPES.FRAUD_REVIEW, userId, { txId, risk }),

  withdrawalCreated: (userId, withdrawalId, amount, currency) =>
    writeAuditLog(AUDIT_TYPES.WITHDRAWAL_CREATED, userId, { withdrawalId, amount, currency }),

  withdrawalProcessed: (userId, withdrawalId, amount) =>
    writeAuditLog(AUDIT_TYPES.WITHDRAWAL_PROCESSED, userId, { withdrawalId, amount }),

  withdrawalFailed: (userId, withdrawalId, reason) =>
    writeAuditLog(AUDIT_TYPES.WITHDRAWAL_FAILED, userId, { withdrawalId, reason }),

  withdrawalReversed: (userId, withdrawalId, amount, reason) =>
    writeAuditLog(AUDIT_TYPES.WITHDRAWAL_REVERSED, userId, { withdrawalId, amount, reason }),

  depositCredited: (userId, reference, amount, currency, provider) =>
    writeAuditLog(AUDIT_TYPES.DEPOSIT_CREDITED, userId, { reference, amount, currency, provider }),

  walletReconciliation: (userId, ledgerCents, walletCents, diffCents) =>
    writeAuditLog(AUDIT_TYPES.WALLET_RECONCILIATION, userId, { ledgerCents, walletCents, diffCents }),

  earnCompleted: (userId, opportunityId, reward) =>
    writeAuditLog("earn.completed", userId, { opportunityId, reward }),

  academyCompleted: (userId, lessonId, reward) =>
    writeAuditLog("earn.academy_completed", userId, { lessonId, reward }),
};
