import { describe, it, expect } from "vitest";
import { registerNode } from "../mesh/nodeRegistry.js";
import { registerEdge } from "../mesh/edgeRegistry.js";
import { findBestRoute } from "../routing/routingEngine.js";

describe("global routing engine", () => {
  it("finds best multi-hop route", () => {
    registerNode({ id: "R1", type: "BANK", region: "US", currencies: ["USD"], liquidity: { USD: 1_000_000 } });
    registerNode({ id: "R2", type: "PSP", region: "EU", currencies: ["USD", "EUR"], liquidity: { USD: 500_000, EUR: 500_000 } });
    registerNode({ id: "R3", type: "BANK", region: "EU", currencies: ["EUR"], liquidity: { EUR: 700_000 } });
    registerEdge({ from: "R1", to: "R2", currencyPair: "USD/USD", fee: 4, latency: 40, capacity: 200000, fxRate: 1, reliability: 0.95 });
    registerEdge({ from: "R2", to: "R3", currencyPair: "USD/EUR", fee: 3, latency: 30, capacity: 200000, fxRate: 0.92, reliability: 0.95 });

    const route = findBestRoute({ fromCurrency: "USD", toCurrency: "EUR", amount: 1000 });
    expect(route).toBeTruthy();
    expect(route?.route.length).toBeGreaterThan(1);
  });
});
