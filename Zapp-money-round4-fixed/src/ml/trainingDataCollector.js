import { logger } from "../lib/logger.js";
import { eventBus } from "../events/eventBus.js";
import { EVENT_TYPES } from "../events/eventTypes.js";
import { db } from "../db/index.js";

let initialized = false;
let tableReady = false;
const pendingByTransaction = new Map();

async function ensureTables() {
  if (tableReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS ml_training_data (
      id BIGSERIAL PRIMARY KEY,
      features JSONB NOT NULL,
      label INT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  tableReady = true;
}

async function appendTrainingRow(features, label) {
  try {
    await ensureTables();
    await db.query(`INSERT INTO ml_training_data (features, label) VALUES ($1, $2)`, [JSON.stringify(features || {}), label]);
  } catch (error) {
    logger.error("ml_training_data insert failed", { error: error.message });
  }
}

export function initTrainingDataCollector() {
  if (initialized) return;

  eventBus.on(EVENT_TYPES.FRAUD_DECISION_MADE, ({ payload, transactionId }) => {
    setImmediate(() => {
      pendingByTransaction.set(transactionId, {
        features: payload?.features || {},
        hasHighRiskAlert: false,
        decisionOutcome: payload?.decision || null,
        fraudResult: payload?.decision || null,
        settlementResult: null,
      });
    });
  });

  eventBus.on(EVENT_TYPES.FRAUD_ALERT_HIGH_RISK, ({ transactionId }) => {
    setImmediate(() => {
      const prior = pendingByTransaction.get(transactionId) || { features: {}, hasHighRiskAlert: false, decisionOutcome: null, fraudResult: null, settlementResult: null };
      prior.hasHighRiskAlert = true;
      pendingByTransaction.set(transactionId, prior);
      appendTrainingRow({ ...prior.features, decisionOutcome: prior.decisionOutcome, fraudResult: "HIGH_RISK_ALERT", settlementResult: prior.settlementResult }, 1);
    });
  });

  eventBus.on(EVENT_TYPES.SETTLEMENT_COMPLETED, ({ payload, transactionId }) => {
    setImmediate(() => {
      if (payload?.status !== "SETTLED") return;
      const prior = pendingByTransaction.get(transactionId);
      const label = prior?.hasHighRiskAlert ? 1 : 0;
      const enrichedFeatures = {
        ...(prior?.features || {}),
        decisionOutcome: prior?.decisionOutcome || null,
        fraudResult: prior?.fraudResult || (prior?.hasHighRiskAlert ? "HIGH_RISK_ALERT" : "CLEAR"),
        settlementResult: payload?.status || "SETTLED",
      };
      appendTrainingRow(enrichedFeatures, label);
      pendingByTransaction.delete(transactionId);
    });
  });

  initialized = true;
}
