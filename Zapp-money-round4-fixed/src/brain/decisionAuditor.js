import { eventBus } from "../events/eventBus.js";
import { EVENT_TYPES } from "../events/eventTypes.js";
import { db } from "../db/index.js";
import { logger } from "../lib/logger.js";

let initialized = false;
let tableReady = false;

async function ensureTable() {
  if (tableReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS brain_decisions (
      id BIGSERIAL PRIMARY KEY,
      type TEXT NOT NULL,
      payload JSONB NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  tableReady = true;
}

async function append(type, payload) {
  try {
    await ensureTable();
    await db.query(`INSERT INTO brain_decisions (type, payload) VALUES ($1, $2)`, [type, JSON.stringify(payload || {})]);
  } catch (error) {
    logger.error("brain_decisions insert failed", { error: error.message });
  }
}

export function initDecisionAuditor() {
  if (initialized) return;
  [EVENT_TYPES.BRAIN_DECISION_MADE, EVENT_TYPES.BRAIN_DECISION_EXECUTED, EVENT_TYPES.BRAIN_DECISION_SKIPPED].forEach((type) => {
    eventBus.on(type, ({ payload }) => {
      setImmediate(() => append(type, payload));
    });
  });
  initialized = true;
}
