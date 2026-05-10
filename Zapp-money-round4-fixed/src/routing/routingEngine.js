import { listNodes } from "../mesh/nodeRegistry.js";
import { getEdges } from "../mesh/edgeRegistry.js";
import { getAvailableLiquidity } from "../mesh/liquidityManager.js";
import { getRouteStats } from "./routeMemory.js";

export function findBestRoute({ fromCurrency, toCurrency, amount }) {
  const nodes = listNodes();
  const starts = nodes.filter((n) => n.currencies.includes(fromCurrency));
  const ends = new Set(nodes.filter((n) => n.currencies.includes(toCurrency)).map((n) => n.id));
  let best = null;

  for (const s of starts) {
    const q = [{ id: s.id, score: 0, path: [s.id], cost: 0, latency: 0 }];
    while (q.length) {
      const cur = q.shift();
      if (!cur) break;
      if (cur.path.length > 5) continue;
      if (cur.id !== s.id && ends.has(cur.id)) {
        const stats = getRouteStats(cur.path);
        const confidence = Math.max(0.5, 1 - ((cur.score + stats.failureRate * 5) / 500));
        const candidate = { route: cur.path, totalCost: cur.cost + stats.avgCost, confidence, estimatedTime: cur.latency + stats.avgLatency };
        if (!best || candidate.totalCost < best.totalCost) best = candidate;
        continue;
      }

      for (const e of getEdges(cur.id)) {
        if (e.capacity < amount) continue;
        const outCur = String(e.currencyPair || "").split("/")[1] || toCurrency;
        const liq = getAvailableLiquidity(e.to, outCur);
        if (liq < amount) continue;
        const feeCost = e.fee;
        const fxCost = Math.abs((e.fxRate || 1) - 1) * amount;
        const latencyCost = e.latency;
        const liquidityScore = Math.min(liq / Math.max(1, amount), 10);
        const reliabilityScore = Number(e.reliability || 0.9) * 10;
        const hist = getRouteStats([...cur.path, e.to]);
        const historicalPerformanceScore = hist.successRate * 5;
        const score = feeCost + fxCost + latencyCost - liquidityScore - reliabilityScore - historicalPerformanceScore;

        q.push({ id: e.to, score: cur.score + score, path: [...cur.path, e.to], cost: cur.cost + feeCost + fxCost, latency: cur.latency + e.latency });
      }
    }
  }

  return best;
}
