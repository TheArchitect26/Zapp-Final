import { db } from "../db/index.js";
import { broadcast } from "../realtime/socket.server.js";
import { logger } from "../lib/logger.js";
import { auditLog } from "../lib/auditLog.js";

import {
  createTransaction as createLedgerTransaction,
  debit,
  credit,
  getBalance,
  assertDoubleEntry,
  toCents,
} from "../services/ledger.service.js";

import { eventBus } from "../events/eventBus.js";
import { EVENT_TYPES } from "../events/eventTypes.js";
import { systemGovernor } from "../governance/systemGovernor.js";
import {
  getGovernanceMode,
  GOVERNANCE_MODE,
} from "../governance/governanceMode.js";
import { runTransactionGate } from "./transactionGate.js";

/* =========================================================
   STATUS
========================================================= */
const STATUS = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  SETTLED: "SETTLED",
  FAILED: "FAILED",
};

/* =========================================================
   FRAUD CACHE (SAFE + BOUNDED)
========================================================= */
const fraudState = new Map();
const MAX_FRAUD_CACHE = 5000;

function trimFraudCache() {
  if (fraudState.size <= MAX_FRAUD_CACHE) return;
  const firstKey = fraudState.keys().next().value;
  fraudState.delete(firstKey);
}

/* =========================================================
   FRAUD LISTENERS
========================================================= */
eventBus.on(EVENT_TYPES.FRAUD_DECISION_MADE, (event) => {
  const tid = event.transactionId;
  if (!tid) return;
  trimFraudCache();
  fraudState.set(tid, {
    risk: event.payload?.risk,
    decision: event.payload?.riskLevel,
  });
});

eventBus.on(EVENT_TYPES.FRAUD_BLOCK_TRANSACTION, (event) => {
  const tid = event.transactionId;
  if (!tid) return;
  fraudState.set(tid, {
    risk: event.payload?.risk,
    decision: "BLOCK",
  });
});

/* =========================================================
   CREATE TRANSACTION
========================================================= */
export async function createTransaction(data, idempotencyKey = null) {
  const mode = await getGovernanceMode();

  const gov = await systemGovernor.canExecute({
    amount: data.amount,
    risk: data.risk || 0,
    type: data.type || "transaction",
  });

  const isSimulation = mode === GOVERNANCE_MODE.SIMULATION;

  if (!gov.ok && !isSimulation) {
    throw new Error(`GOVERNANCE_BLOCK:${gov.reason}`);
  }

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const tx = await createLedgerTransaction(
      { ...data, status: "pending" },
      idempotencyKey,
      client
    );

    // Persist fraud enforcement so the settlement worker can block without
    // relying on the in-memory fraudState cache (which may not be populated yet).
    // REVIEW must be persisted here so the cold-cache gate path also holds it.
    const enforcement = data.fraudEnforcement || "ALLOW";
    const riskMetadata = {
      risk: data.risk || 0,
      fraudDecision: (enforcement === "BLOCK" || enforcement === "REVIEW") ? enforcement : "ALLOW",
    };

    const settlement = await client.query(
      `INSERT INTO settlement_queue
       (transaction_id, from_account, to_account, amount, currency, status, risk_metadata, retry_count, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,0,NOW(),NOW())
       ON CONFLICT (transaction_id) DO UPDATE SET transaction_id = EXCLUDED.transaction_id
       RETURNING *`,
      [
        tx.id,
        data.from,
        data.to,
        data.amount,
        data.currency || "USD",
        STATUS.PENDING,
        JSON.stringify(riskMetadata),
      ]
    );

    await client.query("COMMIT");

    eventBus.emit(EVENT_TYPES.TRANSACTION_CREATED, {
      amount: data.amount,
      currency: data.currency || "USD",
      from: data.from,
      to: data.to,
      settlementId: settlement.rows[0]?.id || null,
    });

    eventBus.emit(EVENT_TYPES.SETTLEMENT_QUEUED, {
      settlementId: settlement.rows[0]?.id || null,
      status: STATUS.PENDING,
    });

    await systemGovernor.registerExecution({
      amount: data.amount,
      type: data.type || "transaction",
    });

    auditLog.transactionCreated(data.from, tx.id, data.amount, data.currency || "USD");

    return { transaction: tx, settlement: settlement.rows[0] };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/* =========================================================
   SETTLEMENT ENGINE
========================================================= */
async function settleOnce(transactionId) {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const lock = await client.query(
      `SELECT * FROM settlement_queue WHERE transaction_id = $1 FOR UPDATE`,
      [transactionId]
    );

    if (!lock.rows.length) throw new Error("SETTLEMENT_NOT_FOUND");

    const job = lock.rows[0];

    // ── Basic field validation ──────────────────────────────────────────────
    if (!job.from_account || !job.to_account || Number(job.amount) <= 0) {
      throw new Error("INVALID_SETTLEMENT_REQUEST");
    }

    // Skip already-processed jobs before running expensive gate checks
    if (job.status !== STATUS.PENDING) {
      await client.query("ROLLBACK");
      return { success: true, skipped: true, status: job.status };
    }

    // 🔴 FULL TRANSACTION GATE — fraud + balance + governance + liquidity
    const gate = await runTransactionGate(job, fraudState, client);
    if (!gate.ok) {
      await client.query(
        `UPDATE settlement_queue
         SET status = $1, last_error = $2, updated_at = NOW()
         WHERE id = $3`,
        [STATUS.FAILED, gate.reason, job.id]
      );
      await client.query("COMMIT");
      logger.warn("Settlement blocked by transaction gate", { transactionId, reason: gate.reason });
      return {
        success: false,
        status: STATUS.FAILED,
        error: gate.reason,
      };
    }

    const updated = await client.query(
      `UPDATE settlement_queue
       SET status = $1, updated_at = NOW()
       WHERE id = $2 AND status = $3`,
      [STATUS.PROCESSING, job.id, STATUS.PENDING]
    );

    if (updated.rowCount === 0) {
      await client.query("ROLLBACK");
      return { success: true, skipped: true, status: job.status };
    }

    // =====================================================
    // LEDGER EXECUTION
    // Clear any orphaned entries from a prior partial failure
    // before inserting new ones, so assertDoubleEntry stays clean.
    // =====================================================
    await client.query(
      `DELETE FROM wallet_ledger WHERE transaction_id = $1 AND entry_type IN ('DEBIT','CREDIT')`,
      [transactionId]
    );

    await debit(
      job.from_account,
      Number(job.amount),
      transactionId,
      job.currency,
      client
    );

    await credit(
      job.to_account,
      Number(job.amount),
      transactionId,
      job.currency,
      client
    );

    await assertDoubleEntry(transactionId, client);

    // =====================================================
    // FINALIZE
    // =====================================================
    await client.query(
      `UPDATE settlement_queue
       SET status = $1, processed_at = NOW(), updated_at = NOW(), last_error = NULL
       WHERE id = $2 AND status = $3`,
      [STATUS.SETTLED, job.id, STATUS.PROCESSING]
    );

    await client.query("COMMIT");

    // =====================================================
    // EVENTS (POST COMMIT)
    // =====================================================
    eventBus.emit(EVENT_TYPES.SETTLEMENT_COMPLETED, {
      settlementId: job.id,
      status: STATUS.SETTLED,
    });

    eventBus.emit(EVENT_TYPES.TRANSACTION_PROCESSED, {
      settlementId: job.id,
      status: STATUS.SETTLED,
    });

    broadcast("settlement_completed", {
      transactionId,
      settlementId: job.id,
      status: STATUS.SETTLED,
    });

    auditLog.transactionSettled(job.from_account, transactionId, job.amount, job.currency);

    return { success: true, status: STATUS.SETTLED, id: job.id };
  } catch (error) {
    try {
      await client.query("ROLLBACK");

      const failUpdate = await client.query(
        `UPDATE settlement_queue
         SET status = $1, retry_count = retry_count + 1, updated_at = NOW(), last_error = $2
         WHERE transaction_id = $3 AND status = $4`,
        [STATUS.FAILED, error.message, transactionId, STATUS.PROCESSING]
      );
      if (failUpdate.rowCount === 0) {
        logger.warn("Settlement failure update matched no rows — job may have been claimed by another worker", { transactionId });
      }
    } catch (e) {
      logger.error("Settlement failure update error", { error: e.message });
    }

    auditLog.transactionFailed(null, transactionId, error.message);

    return {
      success: false,
      status: STATUS.FAILED,
      error: error.message,
    };
  } finally {
    client.release();
  }
}

/* =========================================================
   RETRY WRAPPER
========================================================= */
export async function settleTransaction(transactionId, maxRetries = 2) {
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      return await settleOnce(transactionId);
    } catch (error) {
      if (error.code !== "40P01" || attempt === maxRetries) {
        return {
          success: false,
          status: STATUS.FAILED,
          error: error.message,
        };
      }

      await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
      attempt++;
    }
  }
}

/* =========================================================
   EXPORT ENGINE
========================================================= */
export const MoneyEngine = {
  createTransaction,
  settleTransaction,
  STATUS,
};
