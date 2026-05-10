import { eventBus } from "../events/eventBus.js";
import { EVENT_TYPES } from "../events/eventTypes.js";
import { addTransactionToGraph, getNeighbors, getGraphSnapshot } from "./transactionGraph.js";

function detectRing(from, to) {
  const neighborsOfTo = getNeighbors(to);
  for (const edgeToNext of neighborsOfTo) {
    const neighborsOfNext = getNeighbors(edgeToNext.to);
    const closesRing = neighborsOfNext.some((edge) => edge.to === from);
    if (closesRing) {
      return {
        ring: [from, to, edgeToNext.to, from],
        detectedAt: new Date().toISOString(),
      };
    }
  }
  return null;
}

function detectSuspiciousCluster(from) {
  const neighbors = getNeighbors(from);
  const highFrequency = neighbors.filter((edge) => edge.frequency >= 5);
  const hubAndSpoke = neighbors.length >= 6;

  if (highFrequency.length >= 3 || hubAndSpoke) {
    return {
      node: from,
      highFrequencyEdges: highFrequency.length,
      totalOutgoingEdges: neighbors.length,
      pattern: hubAndSpoke ? "hub_spoke" : "high_frequency_cluster",
      detectedAt: new Date().toISOString(),
    };
  }

  return null;
}

export async function runGraphBuilder(packet) {
  if (![EVENT_TYPES.TRANSACTION_CREATED, EVENT_TYPES.SETTLEMENT_COMPLETED].includes(packet.type)) return;

  const edge = addTransactionToGraph(packet);
  if (!edge) return;

  const ring = detectRing(edge.from, edge.to);
  if (ring) {
    eventBus.emit(EVENT_TYPES.GRAPH_RING_DETECTED, {
      transactionId: packet.transactionId,
      ring,
      graph: getGraphSnapshot(),
    }, { transactionId: packet.transactionId });
  }

  const cluster = detectSuspiciousCluster(edge.from);
  if (cluster) {
    eventBus.emit(EVENT_TYPES.GRAPH_SUSPICIOUS_CLUSTER, {
      transactionId: packet.transactionId,
      cluster,
      graph: getGraphSnapshot(),
    }, { transactionId: packet.transactionId });
  }
}
