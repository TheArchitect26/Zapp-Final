const memory = new Map();

function key(route) { return (route || []).join("->"); }

export function recordRouteResult(route, { success = false, cost = 0, latency = 0 } = {}) {
  const k = key(route);
  const prev = memory.get(k) || { attempts: 0, successCount: 0, totalCost: 0, totalLatency: 0 };
  prev.attempts += 1;
  if (success) prev.successCount += 1;
  prev.totalCost += Number(cost || 0);
  prev.totalLatency += Number(latency || 0);
  memory.set(k, prev);
}

export function getRouteStats(route) {
  const v = memory.get(key(route));
  if (!v) return { successRate: 0.5, avgCost: 0, avgLatency: 0, failureRate: 0.5 };
  const successRate = v.successCount / Math.max(1, v.attempts);
  return {
    successRate,
    avgCost: v.totalCost / Math.max(1, v.attempts),
    avgLatency: v.totalLatency / Math.max(1, v.attempts),
    failureRate: 1 - successRate,
  };
}
