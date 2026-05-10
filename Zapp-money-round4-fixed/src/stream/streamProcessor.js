import { eventBus } from "../events/eventBus.js";
import { EVENT_TYPES } from "../events/eventTypes.js";
import { runFraudPipeline } from "../fraud/fraudPipeline.js";
import { logEvent } from "../events/eventLogger.js";
import { StreamHub } from "./streamHub.js";
import { db } from "../db/index.js";
import { runGraphBuilder } from "../graph/graphBuilder.js";
import { systemGovernor } from "../governance/systemGovernor.js";

import {
  findBestRoute,
  getBestPartners,
  simulateSettlement,
  updatePartnerHealth,
  rebalanceMesh,
  optimizeFX,
} from "../mesh/index.js";

/* =========================================================
   DEDUP CACHE (IN-MEMORY SAFETY LAYER)
========================================================= */
const processedEvents = new Set();

/* =========================================================
   NORMALIZATION
========================================================= */
function normalizeEvent(event) {
  return {
    type: event.type,
    transactionId: event.transactionId || null,
    createdAt: new Date().toISOString(),
    payload: event.payload || {},
  };
}

/* =========================================================
   SAFE DEDUP
========================================================= */
function isDuplicate(packet) {
  const key = `${packet.type}:${packet.transactionId}`;
  if (processedEvents.has(key)) return true;
  processedEvents.add(key);

  // simple memory cap
  if (processedEvents.size > 50000) {
    const first = processedEvents.values().next().value;
    processedEvents.delete(first);
  }

  return false;
}

/* =========================================================
   FRAUD + GRAPH (SAFE SIDE EFFECTS)
========================================================= */
async function analyticsLayer(packet) {
  if (packet.type === EVENT_TYPES.TRANSACTION_CREATED) {
    await runFraudPipeline({
      ...packet.payload,
      transactionId: packet.transactionId,
    });
  }

  await runGraphBuilder(packet);

  await logEvent({
    type: "analytics.packet",
    transactionId: packet.transactionId,
    payload: packet.payload,
  });
}

/* =========================================================
   MESH LAYER (ISOLATED FINANCIAL INTELLIGENCE)
========================================================= */
async function meshLayer(packet) {
  if (packet.type !== EVENT_TYPES.TRANSACTION_CREATED) return;

  const route = findBestRoute({
    fromCurrency: packet.payload.currency || "USD",
    toCurrency: packet.payload.targetCurrency || packet.payload.currency || "USD",
    amount: Number(packet.payload.amount || 0),
  });

  if (!route) {
    eventBus.emit(EVENT_TYPES.MESH_ROUTE_FAILED, {
      transactionId: packet.transactionId,
      reason: "NO_ROUTE",
    });
    return;
  }

  const approved = systemGovernor.validateMeshRoute(route);
  if (!approved.ok) {
    eventBus.emit(EVENT_TYPES.MESH_ROUTE_FAILED, {
      transactionId: packet.transactionId,
      reason: approved.reason,
    });
    return;
  }

  const fx = optimizeFX({
    amount: packet.payload.amount,
    spread: 0.004,
    volatility: 0.02,
    liquidityPressure: 0.6,
  });

  const partner = getBestPartners(
    Number(packet.payload.amount),
    packet.payload.currency || "USD",
    packet.payload.region || "GLOBAL"
  )[0];

  eventBus.emit(EVENT_TYPES.MESH_SETTLEMENT_SCHEDULED, {
    transactionId: packet.transactionId,
    route,
    fx,
    partnerId: partner?.id,
  });

  if (partner) {
    const sim = await simulateSettlement(partner.id, {
      id: packet.transactionId,
    });

    updatePartnerHealth({
      partnerId: partner.id,
      success: sim.success,
      latency: sim.latency,
    });
  }
}

/* =========================================================
   STREAM HUB
========================================================= */
const streamHub = new StreamHub({
  batchSize: 20,
  maxQueueSize: 5000,

  handler: async (batch) => {
    for (const packet of batch) {
      if (isDuplicate(packet)) continue;

      try {
        /* ANALYTICS FIRST (SAFE) */
        await analyticsLayer(packet);

        /* MESH LAST (RISKY) */
        await meshLayer(packet);

        eventBus.emit(EVENT_TYPES.STREAM_PACKET_PROCESSED, {
          type: packet.type,
          transactionId: packet.transactionId,
        });
      } catch (err) {
        eventBus.emit(EVENT_TYPES.STREAM_PACKET_FAILED, {
          error: err.message,
          packet,
        });
      }
    }
  },
});

/* =========================================================
   INIT
========================================================= */
let initialized = false;

export function initStreamProcessor() {
  if (initialized) return;

  for (const type of Object.values(EVENT_TYPES)) {
    eventBus.on(type, (event) => {
      streamHub.enqueue(normalizeEvent(event));
    });
  }

  initialized = true;
}