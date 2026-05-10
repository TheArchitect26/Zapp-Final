import { eventBus } from "../events/eventBus.js";
import { EVENT_TYPES } from "../events/eventTypes.js";
import { optimizeLiquidity } from "./liquidityOptimizer.js";
import { liquidityPools } from "./liquidityPools.js";
import { liquidityPredictor } from "./liquidityPredictor.js";
import { fxEngine } from "./fxEngine.js";
import { MoneyEngine } from "../core/moneyEngine.js";
import { systemGovernor } from "../governance/systemGovernor.js";

const MAX_POOL_DRAIN = Number(process.env.MAX_POOL_DRAIN || 200_000);
const MIN_RESERVE = Number(process.env.MIN_RESERVE || 50_000);
const CONFIDENCE_THRESHOLD = Number(process.env.CONFIDENCE_THRESHOLD || 0.65);
let initialized = false;

function parseEventToLiquidity(event) {
  return {
    region: event.payload?.region || "GLOBAL",
    currency: event.payload?.currency || "USD",
    amount: Number(event.payload?.amount || 0),
  };
}

function validateAction(action) {
  if (action.confidence < CONFIDENCE_THRESHOLD) return { ok: false, reason: "LOW_CONFIDENCE" };
  if (action.amount <= 0 || action.amount > MAX_POOL_DRAIN) return { ok: false, reason: "MAX_POOL_DRAIN_EXCEEDED" };

  const sourcePool = liquidityPools.getPool(action.fromRegion, action.currency);
  if (!sourcePool) return { ok: false, reason: "SOURCE_POOL_MISSING" };
  if (sourcePool.balance - action.amount < Math.max(sourcePool.reserve, MIN_RESERVE)) return { ok: false, reason: "MIN_RESERVE_BREACH" };

  return { ok: true };
}

async function applyAction(action) {
  const check = validateAction(action);
  const gov = await systemGovernor.canExecute({ amount: action.amount, risk: 0, type: "liquidity_rebalance" });
  if (!check.ok || !gov.ok) {
    eventBus.emit(EVENT_TYPES.LIQUIDITY_ACTION_SKIPPED, { action, reason: check.ok ? gov.reason : check.reason });
    return;
  }

  const fxPlan = fxEngine.optimizeConversion({
    fromCurrency: action.currency,
    toCurrency: action.currency,
    amount: action.amount,
  });

  if (fxPlan.action === "BATCH") {
    eventBus.emit(EVENT_TYPES.LIQUIDITY_ACTION_DELAYED, { action, fxPlan });
    return;
  }

  await MoneyEngine.createTransaction({
    type: "liquidity_rebalance",
    amount: action.amount,
    currency: action.currency,
    from: `pool:${action.fromRegion}`,
    to: `pool:${action.toRegion}`,
    risk: 0,
  });

  liquidityPools.adjustPool(action.fromRegion, action.currency, -action.amount);
  liquidityPools.adjustPool(action.toRegion, action.currency, action.amount);
  await systemGovernor.registerExecution({ amount: action.amount, type: "liquidity_rebalance" });
  eventBus.emit(EVENT_TYPES.LIQUIDITY_ACTION_EXECUTED, { action, fxPlan });
}

async function onSignal(event) {
  const liq = parseEventToLiquidity(event);
  liquidityPredictor.ingestTransaction(liq);
  liquidityPools.upsertPool({ region: liq.region, currency: liq.currency, balance: 200_000, reserve: MIN_RESERVE });

  const actions = optimizeLiquidity();
  await Promise.all(actions.map((a) => applyAction(a).catch((e) => {
    eventBus.emit(EVENT_TYPES.LIQUIDITY_ACTION_SKIPPED, { action: a, reason: e.message });
  })));
}

export function initTreasuryEngine() {
  if (initialized) return;
  [EVENT_TYPES.TRANSACTION_CREATED, EVENT_TYPES.SETTLEMENT_COMPLETED].forEach((eventType) => {
    eventBus.on(eventType, (event) => {
      setImmediate(() => {
        onSignal(event).catch((error) => {
          eventBus.emit(EVENT_TYPES.LIQUIDITY_ACTION_SKIPPED, { reason: error.message, eventType });
        });
      });
    });
  });
  initialized = true;
}
