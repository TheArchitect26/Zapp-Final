import { eventBus } from "../events/eventBus.js";
import { EVENT_TYPES } from "../events/eventTypes.js";
import { findBestRoute } from "./routingEngine.js";
import { systemGovernor } from "../governance/systemGovernor.js";
import { MoneyEngine } from "../core/moneyEngine.js";
import { reserveLiquidity, releaseLiquidity } from "./liquidityManager.js";

let initialized = false;

async function executeRoute(route, payload) {
  const hops = [];
  for (let i = 0; i < route.path.length - 1; i += 1) {
    hops.push({ from: route.path[i], to: route.path[i + 1] });
  }

  for (const hop of hops) {
    await MoneyEngine.createTransaction({
      type: "mesh_transfer",
      amount: Number(payload.amount || 0),
      currency: payload.currency || "USD",
      from: `mesh:${hop.from}`,
      to: `mesh:${hop.to}`,
      risk: 0,
    });
  }

  eventBus.emit(EVENT_TYPES.MESH_TRANSFER_EXECUTED, { route, hops, amount: payload.amount, currency: payload.currency });
}

async function processTx(payload) {
  const options = [findBestRoute({ fromCurrency: payload.currency || "USD", toCurrency: payload.targetCurrency || payload.currency || "USD", amount: Number(payload.amount || 0) })].filter(Boolean);

  if (!options.length) {
    eventBus.emit(EVENT_TYPES.MESH_ROUTE_FAILED, { reason: "NO_ROUTE", payload });
    return;
  }

  for (const route of options) {
    const approved = systemGovernor.validateMeshRoute(route);
    if (!approved.ok) {
      eventBus.emit(EVENT_TYPES.MESH_ROUTE_FAILED, { reason: approved.reason, payload, route });
      continue;
    }

    const reserved = reserveLiquidity(route.path[0], payload.currency || "USD", Number(payload.amount || 0));
    if (!reserved) {
      eventBus.emit(EVENT_TYPES.MESH_LIQUIDITY_LOW, { route, payload });
      continue;
    }

    eventBus.emit(EVENT_TYPES.MESH_ROUTE_SELECTED, { route, payload });
    try {
      await executeRoute(route, payload);
      releaseLiquidity(route.path[0], payload.currency || "USD", Number(payload.amount || 0));
      return;
    } catch (error) {
      releaseLiquidity(route.path[0], payload.currency || "USD", Number(payload.amount || 0));
      eventBus.emit(EVENT_TYPES.MESH_ROUTE_FAILED, { reason: error.message, payload, route });
    }
  }
}

export function initMeshOrchestrator() {
  if (initialized) return;
  eventBus.on(EVENT_TYPES.TRANSACTION_CREATED, ({ payload }) => {
    setImmediate(() => {
      processTx(payload).catch((error) => {
        eventBus.emit(EVENT_TYPES.MESH_ROUTE_FAILED, { reason: error.message, payload });
      });
    });
  });
  initialized = true;
}
