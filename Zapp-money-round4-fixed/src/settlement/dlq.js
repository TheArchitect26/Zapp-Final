import { db } from "../db/index.js";

export async function writeSettlementDlq({ settlementId = null, transactionId, payload = {}, failureReason, retryCount = 0, workerId = null, lastStatus = null }, executor = db) {
  await executor.query(
    `INSERT INTO settlement_dlq (settlement_id, transaction_id, payload, failure_reason, retry_count, worker_id, last_status)
     VALUES ($1,$2,$3::jsonb,$4,$5,$6,$7)`,
    [settlementId, transactionId, JSON.stringify(payload || {}), failureReason, retryCount, workerId, lastStatus]
  );
}
