import { describe, it, expect } from "vitest";
import { calculateCorridorProfitability } from "../treasury/profitEngine.js";
import { allocateLiquidity } from "../treasury/liquidityAllocator.js";

describe("treasury brain modules", () => {
  it("computes profitability", () => {
    const p = calculateCorridorProfitability({ volume: 1000, feeRevenue: 50, fxCost: 10, liquidityCost: 5 });
    expect(p.profit).toBe(35);
  });

  it("allocates liquidity action", () => {
    const a = allocateLiquidity({ demand: 900, available: 500, reserve: 200, confidence: 0.8 });
    expect(["REBALANCE", "PRE_FUND", "WITHDRAW", "HOLD"]).toContain(a.action);
  });
});
