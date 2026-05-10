import { eventBus } from "../events/eventBus.js";
import { EVENT_TYPES } from "../events/eventTypes.js";
import { addPosition, clearPositions } from "./positionStore.js";
import { calculateNetPositions } from "./nettingEngine.js";
import { executeSettlement } from "./settlementExecutor.js";
import { logger } from "../lib/logger.js";

let initialized = false;

async function runBatch() {
  const net = calculateNetPositions();
  if (!net.length) return;
  eventBus.emit(EVENT_TYPES.SETTLEMENT_NET_CALCULATED, { count: net.length, positions: net });
  let allOk = true;
  for (const pos of net) {
    const res = await executeSettlement(pos).catch((e) => ({ executed: false, reason: e.message }));
    if (res.executed) {
      eventBus.emit(EVENT_TYPES.SETTLEMENT_BATCH_EXECUTED, { position: pos, tx: res.tx });
    } else {
      allOk = false;
      logger.error("net_settlement failed", { position: pos, reason: res.reason });
    }
  }
  // Only clear positions when all settled — failed positions are retried next batch.
  if (allOk) clearPositions();
}

export function initSettlementScheduler({ intervalMs = 60_000 } = {}) {
  if (initialized) return;
  eventBus.on(EVENT_TYPES.TRANSACTION_CREATED, ({ payload }) => {
    addPosition(payload.from || "unknown", payload.to || "unknown", payload.currency || "USD", Number(payload.amount || 0));
  });
  setInterval(() => { runBatch().catch(() => {}); }, intervalMs);
  initialized = true;
}
