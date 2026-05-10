import { eventBus } from "../events/eventBus.js";
import { EVENT_TYPES } from "../events/eventTypes.js";
import { liquidityPools } from "../liquidity/liquidityPools.js";
import { optimizeLiquidity } from "../liquidity/liquidityOptimizer.js";

export async function rebalanceMesh(payload = {}) {
  const pool = liquidityPools.getPool(payload.region || "GLOBAL", payload.currency || "USD") || liquidityPools.upsertPool({ region: payload.region || "GLOBAL", currency: payload.currency || "USD", balance: 100000, reserve: 20000 });
  const actions = optimizeLiquidity();
  const selected = actions[0] || { type: "HOLD", amount: 0, fromRegion: pool.region, toRegion: pool.region, currency: pool.currency, confidence: 0.6 };

  eventBus.emit(EVENT_TYPES.MESH_TREASURY_REBALANCED, { selected, pool });
  return selected;
}
