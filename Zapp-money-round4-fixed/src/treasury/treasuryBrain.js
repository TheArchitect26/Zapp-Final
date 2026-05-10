import { eventBus } from "../events/eventBus.js";
import { EVENT_TYPES } from "../events/eventTypes.js";
import { calculateCorridorProfitability } from "./profitEngine.js";
import { allocateLiquidity } from "./liquidityAllocator.js";
import { systemGovernor } from "../governance/systemGovernor.js";
import { MoneyEngine } from "../core/moneyEngine.js";

let initialized = false;

async function optimizeLiquidity(payload) {
  const profitability = calculateCorridorProfitability({ volume: payload.amount || 0, feeRevenue: (payload.amount || 0) * 0.01, fxCost: (payload.amount || 0) * 0.002, liquidityCost: (payload.amount || 0) * 0.001 });
  const allocation = allocateLiquidity({ demand: payload.amount || 0, available: 200000, reserve: 50000, confidence: Math.max(0.6, 0.8 + profitability.margin) });

  const decision = { action: allocation.action, region: payload.region || "GLOBAL", currency: payload.currency || "USD", amount: Math.max(0, allocation.amount), confidence: allocation.confidence };
  eventBus.emit(EVENT_TYPES.TREASURY_ACTION_PROPOSED, decision);

  if (decision.action === "HOLD" || decision.amount <= 0) {
    eventBus.emit(EVENT_TYPES.TREASURY_ACTION_SKIPPED, { ...decision, reason: "NO_ACTION" });
    return;
  }

  // approveAction does not exist on systemGovernor — always use canExecute (async)
  const allowed = await systemGovernor.canExecute({ amount: decision.amount, type: "treasury_action", risk: 0 });
  if (!allowed.ok) {
    eventBus.emit(EVENT_TYPES.TREASURY_ACTION_SKIPPED, { ...decision, reason: allowed.reason });
    return;
  }

  await MoneyEngine.createTransaction({ type: "treasury_action", amount: decision.amount, currency: decision.currency, from: `treasury:${decision.region}`, to: `pool:${decision.region}`, risk: 0 });
  await systemGovernor.registerExecution({ amount: decision.amount, type: "treasury_action" });
  eventBus.emit(EVENT_TYPES.TREASURY_ACTION_EXECUTED, decision);
}

export function initTreasuryBrain() {
  if (initialized) return;
  [EVENT_TYPES.TRANSACTION_CREATED, EVENT_TYPES.SETTLEMENT_COMPLETED].forEach((evt) => {
    eventBus.on(evt, ({ payload }) => setImmediate(() => optimizeLiquidity(payload).catch((e) => eventBus.emit(EVENT_TYPES.TREASURY_ACTION_SKIPPED, { reason: e.message }))));
  });
  initialized = true;
}
