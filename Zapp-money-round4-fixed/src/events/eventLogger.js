import { db } from "../db/index.js";

let eventStreamReady = false;

export async function ensureEventStreamTable(executor = db) {
  if (eventStreamReady && executor === db) return;

  await executor.query(`
    CREATE TABLE IF NOT EXISTS event_stream (
      id BIGSERIAL PRIMARY KEY,
      type TEXT NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      transaction_id TEXT NULL
    )
  `);

  if (executor === db) eventStreamReady = true;
}

export async function logEvent({ type, payload = {}, transactionId = null }, executor = db) {
  await ensureEventStreamTable(executor);

  return executor.query(
    `INSERT INTO event_stream (type, payload, transaction_id) VALUES ($1, $2, $3)`,
    [type, JSON.stringify(payload), transactionId]
  );
}
