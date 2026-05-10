/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest";
import { evaluateBrainDecision } from "../brain/decisionEngine.js";
import { initBrainOrchestrator } from "../brain/brainOrchestrator.js";
import { eventBus } from "../events/eventBus.js";
import { EVENT_TYPES } from "../events/eventTypes.js";

describe("brain decision engine", () => {
  it("creates freeze decision for ring detection", () => {
    const d = evaluateBrainDecision({ type: EVENT_TYPES.GRAPH_RING_DETECTED, payload: {}, transactionId: "t1" });
    expect(d.action).toBe("FREEZE_ACCOUNT");
    expect(d.confidence).toBeGreaterThan(0.9);
  });

  it("shadow mode skips execution", async () => {
    process.env.BRAIN_MODE = "SHADOW";
    initBrainOrchestrator();

    const observed = await new Promise<any>((resolve) => {
      eventBus.on(EVENT_TYPES.BRAIN_DECISION_SKIPPED, (evt) => resolve(evt));
      eventBus.emit(EVENT_TYPES.TRANSACTION_CREATED, { amount: 20, from: "a", to: "b", currency: "USD" }, { transactionId: "txn_shadow" });
    });

    expect(observed.payload.reason).toBe("SHADOW_MODE");
  });
});
