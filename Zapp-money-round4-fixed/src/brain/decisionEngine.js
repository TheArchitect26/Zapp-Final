import { EVENT_TYPES } from "../events/eventTypes.js";

function baseDecision(event) {
  return {
    action: "HOLD",
    confidence: 0.5,
    reason: "insufficient_signal",
    eventType: event.type,
    transactionId: event.transactionId || event.payload?.transactionId || null,
    from: event.payload?.from || null,
    to: event.payload?.to || null,
    amount: Number(event.payload?.amount || 0),
    currency: event.payload?.currency || "USD",
    riskLevel: event.payload?.riskLevel || "LOW",
  };
}

export function evaluateBrainDecision(event) {
  const decision = baseDecision(event);

  if (event.type === EVENT_TYPES.GRAPH_RING_DETECTED) {
    return { ...decision, action: "FREEZE_ACCOUNT", confidence: 0.95, reason: "graph_ring_detected", riskLevel: "HIGH" };
  }

  if (event.type === EVENT_TYPES.FRAUD_DECISION_MADE) {
    const level = event.payload?.riskLevel || "LOW";
    if (level === "BLOCK" || level === "HIGH") {
      return { ...decision, action: "FREEZE_ACCOUNT", confidence: Number(event.payload?.confidence || 0.9), reason: "fraud_high_risk", riskLevel: "HIGH" };
    }
    if (level === "MEDIUM") {
      return { ...decision, action: "DELAY", confidence: Number(event.payload?.confidence || 0.7), reason: "fraud_medium_risk", riskLevel: "MEDIUM" };
    }
  }

  if (event.type === EVENT_TYPES.SETTLEMENT_COMPLETED && event.payload?.status === "SETTLED") {
    return { ...decision, action: "MOVE_FUNDS", confidence: 0.72, reason: "settlement_rebalance", amount: Number(event.payload?.amount || decision.amount) };
  }

  if (event.type === EVENT_TYPES.TRANSACTION_CREATED) {
    return { ...decision, action: "HOLD", confidence: 0.65, reason: "awaiting_post_signals" };
  }

  return decision;
}
