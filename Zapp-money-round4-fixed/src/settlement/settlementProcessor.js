import { db } from "../db/index.js";
import { eventBus } from "../events/eventBus.js";
import { EVENT_TYPES } from "../events/eventTypes.js";
import { systemGovernor } from "../governance/systemGovernor.js";
import { debit, credit, getBalance, assertDoubleEntry, toCents } from "../services/ledger.service.js";
import { writeSettlementDlq } from "./dlq.js";

const STATUS = Object.freeze({
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  SETTLED: "SETTLED",
  FAILED: "FAILED",
});

/**
 * NOTE: Settlement schema (settlement_queue table, indexes) is managed
 * exclusively via Supabase migrations in supabase/migrations/.
 * Runtime DDL has been removed. Run migrations before starting the server.
 */

function emitLifecycle(type, base) {
  eventBus.emit(type, base, { transactionId: base.transactionId });
}

function computeBackoffMs(retryCount, baseMs = 500, maxMs = 120000) {
  const jitter = Math.floor(Math.random() * 150);
  return Math.min(maxMs, baseMs * (2 ** retryCount)) + jitter;
}

export async function claimSettlementJob({ workerId, now = new Date() }, executor = db) {
  const result = await executor.query(
    `WITH picked AS (
      SELECT id
      FROM settlement_queue
      WHERE status IN ('PENDING','FAILED')
        AND COALESCE(available_at, NOW()) <= $2
        AND retry_count < 5
      ORDER BY created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE settlement_queue sq
       SET status = $3,
           locked_by = $1,
           locked_at = NOW(),
           updated_at = NOW()
      FROM picked
     WHERE sq.id = picked.id
     RETURNING sq.*`,
    [workerId, now.toISOString(), STATUS.PROCESSING]
  );

  return result.rows[0] || null;
}

export async function processSettlementJob(job, { workerId, maxRetries = 5 } = {}) {
  const startedAt = Date.now();
  const context = {
    transactionId: job.transaction_id,
    settlementId: job.id,
    workerId,
    timestamp: new Date().toISOString(),
    riskMetadata: job.risk_metadata || {},
  };

  emitLifecycle(EVENT_TYPES.SETTLEMENT_STARTED, context);
  emitLifecycle(EVENT_TYPES.SETTLEMENT_PROCESSING, context);

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const locked = await client.query(
      `SELECT * FROM settlement_queue WHERE id = $1 FOR UPDATE`,
      [job.id]
    );
    if (!locked.rows.length) throw new Error("SETTLEMENT_GONE");
    const current = locked.rows[0];
    if (current.status !== STATUS.PROCESSING || current.locked_by !== workerId) {
      await client.query("ROLLBACK");
      return { ok: true, skipped: true, latencyMs: Date.now() - startedAt };
    }

    if (["BLOCK", "REVIEW"].includes(String(current.risk_metadata?.fraudDecision || "").toUpperCase())) {
      throw new Error("FRAUD_BLOCKED");
    }

    const gov = await systemGovernor.canExecute({ amount: Number(current.amount), risk: Number(current.risk_metadata?.risk || 0), type: "settlement" });
    if (!gov.ok) throw new Error(`GOVERNANCE_BLOCK:${gov.reason}`);

    const balCents = await getBalance(current.from_account, current.currency, client);
    const amountCents = toCents(current.amount);
    if (balCents < amountCents) throw new Error("INSUFFICIENT_FUNDS");

    await debit(current.from_account, Number(current.amount), current.transaction_id, current.currency, client);
    await credit(current.to_account, Number(current.amount), current.transaction_id, current.currency, client);
    await assertDoubleEntry(current.transaction_id, client);

    await client.query(
      `UPDATE settlement_queue
          SET status = $1, processed_at = NOW(), updated_at = NOW(), last_error = NULL
        WHERE id = $2`,
      [STATUS.SETTLED, current.id]
    );

    await client.query("COMMIT");
    emitLifecycle(EVENT_TYPES.SETTLEMENT_COMPLETED, context);
    return { ok: true, skipped: false, latencyMs: Date.now() - startedAt };
  } catch (error) {
    await client.query("ROLLBACK");
    const nextRetry = Number(job.retry_count || 0) + 1;
    const finalFailure = nextRetry >= maxRetries;
    const nextBackoffMs = computeBackoffMs(nextRetry);

    await db.query(
      `UPDATE settlement_queue
          SET status = $1,
              retry_count = retry_count + 1,
              last_error = $2,
              available_at = CASE WHEN $3 THEN available_at ELSE NOW() + ($4::text || ' milliseconds')::interval END,
              updated_at = NOW()
        WHERE id = $5`,
      [finalFailure ? STATUS.FAILED : STATUS.PENDING, error.message, finalFailure, String(nextBackoffMs), job.id]
    );

    if (finalFailure) {
      await writeSettlementDlq({
        settlementId: job.id,
        transactionId: job.transaction_id,
        payload: job,
        failureReason: error.message,
        retryCount: nextRetry,
        workerId,
        lastStatus: STATUS.FAILED,
      });
    }

    emitLifecycle(EVENT_TYPES.SETTLEMENT_FAILED, { ...context, error: error.message, retryCount: nextRetry });
    return { ok: false, skipped: false, retried: !finalFailure, latencyMs: Date.now() - startedAt, error: error.message };
  } finally {
    client.release();
  }
}
