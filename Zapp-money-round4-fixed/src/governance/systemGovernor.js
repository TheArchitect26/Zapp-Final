import { eventBus } from "../events/eventBus.js";
import { EVENT_TYPES } from "../events/eventTypes.js";
import { systemState } from "./systemState.js";
import { stateGet, stateIncrement } from "./stateStore.js";
import { GOVERNANCE_MODE, getGovernanceMode } from "./governanceMode.js";

const MAX_DAILY_VOLUME    = Number(process.env.GOV_MAX_DAILY_VOLUME    || 2_000_000);
const MAX_RISK_SCORE      = Number(process.env.GOV_MAX_RISK_SCORE      || 0.75);
const MAX_LIQUIDITY_DRAIN = Number(process.env.GOV_MAX_LIQ_DRAIN       || 300_000);

function dayKey() {
  return new Date().toISOString().slice(0, 10);
}

function reject(reason, ctx = {}, mode = "") {
  eventBus.emit(EVENT_TYPES.GOVERNANCE_VIOLATION, { reason, ...ctx, mode });
  return { ok: false, reason };
}

export const systemGovernor = {
  async canExecute({ amount = 0, risk = 0, type = "generic" } = {}) {
    const currentMode = await getGovernanceMode();

    if (
      currentMode === GOVERNANCE_MODE.FREEZE_ALL ||
      currentMode === GOVERNANCE_MODE.READ_ONLY
    ) {
      return reject("MODE_BLOCK", { type, amount }, currentMode);
    }

    if (Number(risk) > MAX_RISK_SCORE) {
      return reject("RISK_LIMIT", { type, risk }, currentMode);
    }

    const key    = dayKey();
    const state  = await stateGet(`sysGov:volume:${key}`) ?? { volume: 0, liqDrain: 0 };
    const volume = Number(state.volume ?? 0);

    if (volume + Number(amount) > MAX_DAILY_VOLUME) {
      return reject("DAILY_VOLUME_LIMIT", { type, amount }, currentMode);
    }

    if (String(type).includes("liquidity")) {
      const liqDrain = Number(state.liqDrain ?? 0);
      if (liqDrain + Number(amount) > MAX_LIQUIDITY_DRAIN) {
        return reject("LIQUIDITY_DRAIN_LIMIT", { amount }, currentMode);
      }
    }

    return { ok: true, reason: "OK" };
  },

  validateMeshRoute(route = {}) {
    const hops = Array.isArray(route.path) ? Math.max(0, route.path.length - 1) : 0;
    if (hops === 0)   return reject("MESH_ROUTE_EMPTY");
    if (hops > 5)     return reject("MESH_ROUTE_TOO_LONG", { hops });
    if (Number(route.confidence || 0) < 0.55) {
      return reject("MESH_ROUTE_LOW_CONFIDENCE");
    }
    return { ok: true, reason: "OK" };
  },

  async registerExecution({ amount = 0, type = "generic" } = {}) {
    const key = dayKey();
    await stateIncrement(`sysGov:volume:${key}`, "volume", Number(amount));
    if (String(type).includes("liquidity")) {
      await stateIncrement(`sysGov:volume:${key}`, "liqDrain", Number(amount));
    }
  },
};
