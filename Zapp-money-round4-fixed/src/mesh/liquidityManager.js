import { getNode } from "./nodeRegistry.js";
import { liquidityPools } from "../liquidity/liquidityPools.js";

const reserved = new Map();

function key(nodeId, currency) { return `${nodeId}:${currency}`; }

export function getAvailableLiquidity(nodeId, currency) {
  const node = getNode(nodeId);
  const nodeLiq = Number(node?.liquidity?.[currency] || 0);
  const poolLiq = Number(liquidityPools.getPool(node?.region || "GLOBAL", currency)?.balance || 0);
  const held = Number(reserved.get(key(nodeId, currency)) || 0);
  return Math.max(0, Math.max(nodeLiq, poolLiq) - held);
}

export function reserveLiquidity(nodeId, currency, amount) {
  const available = getAvailableLiquidity(nodeId, currency);
  if (available < amount) return false;
  const k = key(nodeId, currency);
  reserved.set(k, Number(reserved.get(k) || 0) + Number(amount));
  return true;
}

export function releaseLiquidity(nodeId, currency, amount) {
  const k = key(nodeId, currency);
  const next = Math.max(0, Number(reserved.get(k) || 0) - Number(amount));
  reserved.set(k, next);
}
