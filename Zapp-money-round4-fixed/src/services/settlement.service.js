import { db } from "../db/index.js";
import { MoneyEngine } from "../core/moneyEngine.js";

export async function queueSettlement({ transactionId, from, to, amount, currency = "USD" }) {
  const result = await db.query(
    `INSERT INTO settlement_queue
     (transaction_id, from_account, to_account, amount, currency, status, retry_count, created_at)
     VALUES ($1,$2,$3,$4,$5,'PENDING',0,NOW())
     ON CONFLICT (transaction_id) DO UPDATE SET transaction_id = EXCLUDED.transaction_id
     RETURNING *`,
    [transactionId, from, to, amount, currency]
  );
  return result.rows[0];
}

export async function runSettlementBatch(limit = 50) {
  const pending = await db.query(
    `SELECT transaction_id FROM settlement_queue
     WHERE status IN ('PENDING','FAILED')
     AND retry_count < 5
     ORDER BY created_at ASC
     LIMIT $1`,
    [limit]
  );

  const results = [];
  for (const row of pending.rows) {
    results.push(await MoneyEngine.settleTransaction(row.transaction_id));
  }

  return { processed: results.length, results };
}
