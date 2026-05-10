import { db } from "../db/index.js";
import { logger } from "../lib/logger.js";

/* =========================================================
   IN-MEMORY FAST CACHE (low-latency fraud layer)
   Bounded to prevent unbounded memory growth.
========================================================= */
const localMemory = new Map();
const CACHE_MAX = 10_000;

function cacheSet(key, value) {
  if (localMemory.size >= CACHE_MAX) {
    // evict the oldest entry
    localMemory.delete(localMemory.keys().next().value);
  }
  localMemory.set(key, value);
}

/* =========================================================
   BASE RISK ENGINE (rule-based signals)
   Country of origin is intentionally NOT a risk factor —
   risk is derived from transaction behaviour only.
========================================================= */
export function baseRisk(tx) {
  let risk = 0.05;

  // Amount risk curve
  if (tx.amount > 10_000)  risk += 0.15;
  if (tx.amount > 50_000)  risk += 0.25;
  if (tx.amount > 100_000) risk += 0.20;

  // Velocity signals (transactions per window)
  if (tx.velocity > 3)  risk += 0.10;
  if (tx.velocity > 10) risk += 0.25;

  // Unknown device
  if (tx.deviceRisk) risk += Number(tx.deviceRisk) * 0.15;

  return Math.min(risk, 1);
}

/* =========================================================
   HISTORICAL BEHAVIOUR LAYER
========================================================= */
async function getHistoricalRisk(entityId) {
  if (!entityId) return 0.05;

  if (localMemory.has(entityId)) return localMemory.get(entityId);

  try {
    const result = await db.query(
      `SELECT COALESCE(AVG(risk_score), 0.05) AS avg_risk, COUNT(*) AS total
       FROM fraud_memory WHERE entity_id = $1`,
      [entityId]
    );
    const row = result.rows[0];
    const score = row?.total > 0 ? Number(row.avg_risk) : 0.05;
    cacheSet(entityId, score);
    return score;
  } catch {
    return 0.05;
  }
}

/* =========================================================
   MAIN FRAUD SCORING ENGINE
========================================================= */
export async function fraudScore(tx) {
  const base    = baseRisk(tx);
  const history = await getHistoricalRisk(tx.entityId);

  // Weight history more heavily for known bad actors
  const baseWeight    = history > 0.5 ? 0.45 : 0.65;
  const historyWeight = 1 - baseWeight;

  return Math.min(base * baseWeight + history * historyWeight, 1);
}

/* =========================================================
   FRAUD FEEDBACK LOOP (self-learning)
========================================================= */
export async function learnFraud(tx) {
  if (!tx.entityId) {
    logger.warn("learnFraud called without entityId — skipping");
    return;
  }
  const score = tx.risk || 0;

  try {
    await db.query(
      `INSERT INTO fraud_memory
         (entity_id, risk_score, outcome, amount, velocity, created_at)
       VALUES ($1,$2,$3,$4,$5,NOW())`,
      [
        tx.entityId,
        score,
        tx.outcome || "unknown",
        tx.amount || 0,
        tx.velocity || 1,
      ]
    );
  } catch (err) {
    logger.error("learnFraud error", { error: err.message });
  }

  // Invalidate cache so next request re-learns
  if (tx.entityId) localMemory.delete(tx.entityId);
}

/* =========================================================
   RISK CLASSIFIER
========================================================= */
export function classifyRisk(score) {
  if (score < 0.25) return "LOW";
  if (score < 0.65) return "MEDIUM";
  return "HIGH";
}

export function riskSignal(score) {
  return {
    level:  classifyRisk(score),
    block:  score >= 0.85,
    review: score >= 0.65 && score < 0.85,
    allow:  score < 0.65,
  };
}
