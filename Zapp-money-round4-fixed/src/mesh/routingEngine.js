import { listNodes } from "./nodeRegistry.js";
import { getEdges } from "./edgeRegistry.js";
import { getAvailableLiquidity } from "./liquidityManager.js";
import { getRouteStats } from "../routing/routeMemory.js";

const MAX_ROUTE_COST = Number(process.env.MAX_ROUTE_COST || 50000);
const MAX_LATENCY = Number(process.env.MAX_ROUTE_LATENCY || 5000);

export function findBestRoute({ fromCurrency, toCurrency, amount }) {
  const nodes = listNodes();
  const starts = nodes.filter((n) => n.currencies.includes(fromCurrency));
  const ends = new Set(nodes.filter((n) => n.currencies.includes(toCurrency)).map((n) => n.id));
  const candidates = [];

  for (const s of starts) {
    const q = [{ id: s.id, path: [s.id], cost: 0, latency: 0, risk: 0, steps: [] }];
    while (q.length) {
      const cur = q.shift();
      if (!cur || cur.path.length > 6) continue;
      if (cur.id !== s.id && ends.has(cur.id)) {
        const stats = getRouteStats(cur.path);
        const confidence = Math.max(0.5, 1 - ((cur.cost + cur.risk * 100 + stats.failureRate * 5) / 2000));
        candidates.push({ routeId: `route_${Date.now()}_${Math.random().toString(16).slice(2,6)}`, route: cur.path, steps: cur.steps, totalCost: cur.cost, totalLatency: cur.latency, riskScore: cur.risk, confidence });
        continue;
      }
      for (const e of getEdges(cur.id)) {
        if (cur.path.includes(e.to)) continue;
        const outCur = String(e.currencyPair || "").split("/")[1] || toCurrency;
        const liq = getAvailableLiquidity(e.to, outCur);
        if (liq <= 0) continue;
        const splitAmount = Math.min(amount, liq);
        const fee = Number(e.fee || 0);
        const latency = Number(e.latency || 0);
        const risk = 1 - Number(e.reliability || 0.9);
        q.push({
          id: e.to,
          path: [...cur.path, e.to],
          cost: cur.cost + fee + Math.abs((Number(e.fxRate || 1)-1) * splitAmount),
          latency: cur.latency + latency,
          risk: cur.risk + risk,
          steps: [...cur.steps, { from: e.from, to: e.to, amount: splitAmount, currency: outCur, fxRate: e.fxRate || 1, fee, latency }],
        });
      }
    }
  }

  const viable = candidates.filter((c) => c.totalCost <= MAX_ROUTE_COST && c.totalLatency <= MAX_LATENCY)
    .sort((a,b) => (a.totalCost + a.riskScore*100 + a.totalLatency*0.1) - (b.totalCost + b.riskScore*100 + b.totalLatency*0.1));

  if (!viable.length) return null;
  const primary = viable[0];
  primary.fallbackRoutes = viable.slice(1,3);
  return primary;
}
