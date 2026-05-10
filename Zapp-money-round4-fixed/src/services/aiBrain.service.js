import { db } from "../db/index.js";

/* =========================================================
   SELF-LEARNING AI BRAIN (RADAR-STYLE)
========================================================= */

/**
 * FRAUD SCORING (LIVE + ADAPTIVE)
 */
export async function fraudScore(tx) {
  let score = 0.1;

  // Amount risk
  if (tx.amount > 10000) score += 0.3;
  if (tx.amount > 50000) score += 0.5;

  // Velocity risk
  if (tx.velocity > 5) score += 0.2;

  // Country risk
  if (tx.countryRisk) score += tx.countryRisk;

  // clamp
  return Math.min(score, 1);
}

/**
 * SELF-LEARNING UPDATE (RADAR FEEDBACK LOOP)
 * Call this after charge/refund outcome
 */
export async function learnFromOutcome(txId, success) {
  await db.query(
    `
    INSERT INTO routing_ai_memory(route_key, success_rate, failure_rate)
    VALUES ($1,$2,$3)
    ON CONFLICT (route_key)
    DO UPDATE SET
      success_rate = (routing_ai_memory.success_rate + $2)/2,
      failure_rate = (routing_ai_memory.failure_rate + $3)/2,
      last_updated = now()
    `,
    [
      txId,
      success ? 1 : 0,
      success ? 0 : 1,
    ]
  );
}

/**
 * ROUTE SCORING (AI DECISION ENGINE)
 */
export function routeScore(route) {
  return (
    route.reliability * 0.4 +
    route.speed * 0.3 +
    route.liquidity * 0.2 -
    route.cost * 0.1
  );
}

/**
 * BALANCE RISK CHECK (REALTIME SAFETY LAYER)
 */
export function balanceRisk(balance, amount) {
  if (balance - amount < 0) return true;
  return false;
}