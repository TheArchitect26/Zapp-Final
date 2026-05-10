import { describe, it, expect } from "vitest";
import { registerNode } from "../mesh/nodeRegistry.js";
import { registerEdge } from "../mesh/edgeRegistry.js";
import { findBestRoute } from "../mesh/routingEngine.js";
import { optimizeFX } from "../mesh/fxOptimizer.js";
import { registerPartner, getBestPartners, simulateSettlement, updatePartnerHealth, getPartner } from "../mesh/partnerNetwork.js";

function seed() {
  registerNode({ id: "A", type: "BANK", region: "US", currencies: ["USD"], liquidity: { USD: 1000000 }, reliability: 0.99, latency: 50 });
  registerNode({ id: "B", type: "PSP", region: "EU", currencies: ["USD", "EUR"], liquidity: { USD: 800000, EUR: 600000 }, reliability: 0.95, latency: 80 });
  registerNode({ id: "C", type: "BANK", region: "EU", currencies: ["EUR"], liquidity: { EUR: 1000000 }, reliability: 0.96, latency: 70 });
  registerEdge({ from: "A", to: "B", currencyPair: "USD/USD", fee: 5, latency: 40, capacity: 500000, fxRate: 1, reliability: 0.95 });
  registerEdge({ from: "B", to: "C", currencyPair: "USD/EUR", fee: 4, latency: 50, capacity: 500000, fxRate: 0.92, reliability: 0.95 });
}

describe("mesh routing", () => {
  it("route optimization correctness", () => {
    seed();
    const route = findBestRoute({ fromCurrency: "USD", toCurrency: "EUR", amount: 1000 });
    expect(route).toBeTruthy();
    expect(route?.steps.length).toBeGreaterThan(0);
  });

  it("split payment behavior surfaces partial step amounts", () => {
    seed();
    const route = findBestRoute({ fromCurrency: "USD", toCurrency: "EUR", amount: 900000 });
    expect(route).toBeTruthy();
    expect(route?.steps[0].amount).toBeLessThanOrEqual(900000);
  });

  it("fallback routing logic exposes fallbackRoutes", () => {
    seed();
    registerNode({ id: "D", type: "CRYPTO", region: "EU", currencies: ["EUR"], liquidity: { EUR: 900000 }, reliability: 0.9, latency: 120 });
    registerEdge({ from: "A", to: "D", currencyPair: "USD/EUR", fee: 20, latency: 90, capacity: 2000000, fxRate: 0.91, reliability: 0.9 });
    const route = findBestRoute({ fromCurrency: "USD", toCurrency: "EUR", amount: 1000 });
    expect(route).toBeTruthy();
    expect(Array.isArray(route?.fallbackRoutes)).toBe(true);
  });

  it("FX optimization decisions are produced", () => {
    const fx = optimizeFX({ amount: 2000, spread: 0.01, volatility: 0.03, liquidityPressure: 0.5 });
    expect(["CONVERT_NOW", "DELAY", "BATCH", "ARBITRAGE"]).toContain(fx.action);
  });

  it("partner failure simulation updates health", async () => {
    registerPartner({ id: "P1", region: "EU", currencies: ["EUR"], capacity: 10000, fxSpread: 0.01, latency: 100, health: 0.1 });
    const partners = getBestPartners(1000, "EUR", "EU");
    expect(partners.length).toBeGreaterThan(0);
    const result = await simulateSettlement("P1", { id: "x" });
    updatePartnerHealth({ partnerId: "P1", success: result.success, latency: result.latency });
    expect(getPartner("P1")?.health).toBeGreaterThan(0);
  });
});
