import { describe, it, expect } from "vitest";
import { liquidityPools } from "../liquidity/liquidityPools.js";
import { liquidityPredictor } from "../liquidity/liquidityPredictor.js";
import { optimizeLiquidity } from "../liquidity/liquidityOptimizer.js";

describe("liquidity optimizer", () => {
  it("proposes redistribution on imbalance", () => {
    liquidityPools.upsertPool({ region: "US", currency: "USD", balance: 500000, reserve: 50000 });
    liquidityPools.upsertPool({ region: "EU", currency: "USD", balance: 10000, reserve: 50000 });
    for (let i = 0; i < 20; i += 1) liquidityPredictor.ingestTransaction({ region: "EU", currency: "USD", amount: 2000 });

    const actions = optimizeLiquidity();
    expect(actions.length).toBeGreaterThan(0);
    expect(actions[0].toRegion).toBe("EU");
  });
});
