import { describe, it, expect } from "vitest";
import { modelService } from "../ml/modelService.js";

describe("modelService", () => {
  it("falls back to heuristic when model is not loaded", async () => {
    const res = await modelService.predict({ velocityPerMinute: 2, frequencyPerHour: 5, amountDeviation: 0.2, countryRisk: 0.1, relationshipSpread: 2 });
    expect(res.score).toBeGreaterThanOrEqual(0);
    expect(res.score).toBeLessThanOrEqual(1);
  });
});
