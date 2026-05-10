import { eventBus } from "../events/eventBus.js";
import { EVENT_TYPES } from "../events/eventTypes.js";
import { evaluateBrainDecision } from "./decisionEngine.js";
import { circuitBreaker } from "./circuitBreaker.js";

let initialized = false;

const BRAIN_EVENTS = [
  EVENT_TYPES.TRANSACTION_CREATED,
  EVENT_TYPES.FRAUD_DECISION_MADE,
  EVENT_TYPES.GRAPH_RING_DETECTED,
  EVENT_TYPES.SETTLEMENT_COMPLETED,
];

export function initBrainOrchestrator() {
  if (initialized) return;

  const configuredMode = (process.env.BRAIN_MODE || "SHADOW").toUpperCase();

  for (const type of BRAIN_EVENTS) {
    eventBus.on(type, async (event) => {
      const decision = evaluateBrainDecision(event);
      if (event.type === EVENT_TYPES.FRAUD_DECISION_MADE && ["HIGH", "BLOCK"].includes(event.payload?.riskLevel)) {
        circuitBreaker.recordFraudSignal();
      }
      circuitBreaker.evaluateRecovery();

      const mode = (await circuitBreaker.isActive()) ? "SHADOW" : configuredMode;
      const enriched = { ...decision, mode, timestamp: new Date().toISOString() };

      eventBus.emit(EVENT_TYPES.BRAIN_DECISION_MADE, enriched, { transactionId: decision.transactionId });

      if (mode === "SHADOW" || mode === "ASSISTED") {
        eventBus.emit(EVENT_TYPES.BRAIN_DECISION_SKIPPED, {
          ...enriched,
          reason: mode === "SHADOW" ? "SHADOW_MODE" : "ASSISTED_MODE",
        }, { transactionId: decision.transactionId });
        return;
      }

      const { executionEngine } = await import("./executionEngine.js");
      const exec = await executionEngine.execute(enriched);
      if (!exec.executed) {
        eventBus.emit(EVENT_TYPES.BRAIN_DECISION_SKIPPED, {
          ...enriched,
          reason: exec.reason,
        }, { transactionId: decision.transactionId });
        return;
      }

      eventBus.emit(EVENT_TYPES.BRAIN_DECISION_EXECUTED, {
        ...enriched,
        execution: exec,
      }, { transactionId: decision.transactionId });
    });
  }

  initialized = true;
}
