import { db } from "../db/index.js";

/* =========================================================
   RULE ENGINE (fast kill-switch layer)
   Risk is derived from transaction behaviour — not geography.
========================================================= */
function ruleScore({ amount, velocity }) {
  let risk = 0;
  if (amount > 100_000) risk += 0.45;
  if (velocity > 10)    risk += 0.30;
  return Math.min(risk, 1);
}

/* =========================================================
   BEHAVIOURAL ML SCORE
========================================================= */
function mlScore({ amount, velocity, pastFraudRate, deviceRisk }) {
  const score =
    (amount > 50_000 ? 0.25 : 0.08) +
    velocity      * 0.15 +
    pastFraudRate * 0.40 +
    deviceRisk    * 0.17;
  return Math.min(score, 1);
}

/* =========================================================
   MAIN FRAUD ENGINE
========================================================= */
export async function fraudBrain(input) {
  const {
    customer_id,
    amount,
    velocity          = 1,
    device_fingerprint = "unknown",
  } = input;

  // Historical fraud rate for this customer
  let pastFraudRate = 0;
  try {
    const history = await db.query(
      `SELECT COUNT(*) FILTER (WHERE is_fraud) AS frauds,
              COUNT(*)                          AS total
       FROM fraud_events WHERE customer_id = $1`,
      [customer_id]
    );
    const { frauds, total } = history.rows[0];
    pastFraudRate = total > 0 ? Number(frauds) / Number(total) : 0;
  } catch { /* DB unavailable — use default */ }

  const deviceRisk = device_fingerprint === "unknown" ? 0.25 : 0.05;

  const rule        = ruleScore({ amount, velocity });
  const ml          = mlScore({ amount, velocity, pastFraudRate, deviceRisk });
  const finalScore  = rule * 0.5 + ml * 0.5;
  const isFraud     = finalScore > 0.65;

  try {
    await db.query(
      `INSERT INTO fraud_events
         (customer_id, amount, velocity, device_fingerprint, risk_score, is_fraud)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [customer_id, amount, velocity, device_fingerprint, finalScore, isFraud]
    );
  } catch { /* non-fatal — telemetry */ }

  return {
    risk_score: finalScore,
    is_fraud: isFraud,
    breakdown: { rule, ml, pastFraudRate, deviceRisk },
  };
}
