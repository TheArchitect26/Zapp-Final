import { liquidityPools } from "./liquidityPools.js";
import { liquidityPredictor } from "./liquidityPredictor.js";

export function optimizeLiquidity() {
  const pools = liquidityPools.listPools();
  const actions = [];

  for (const pool of pools) {
    const pred = liquidityPredictor.predictDemand(pool.region, pool.currency);
    const target = Math.max(pool.reserve, pred.demand * 1.2);
    const gap = target - pool.balance;

    if (gap > 0) {
      const source = pools.find((p) => p.currency === pool.currency && p.balance > p.reserve + gap);
      if (source) {
        actions.push({
          type: "REDISTRIBUTE",
          currency: pool.currency,
          amount: Math.min(gap, source.balance - source.reserve),
          fromRegion: source.region,
          toRegion: pool.region,
          confidence: pred.confidence,
        });
      }
    }
  }

  return actions;
}
