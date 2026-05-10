import { describe, it, expect } from "vitest";
import { riskGovernor } from "../brain/riskGovernor.js";
import { shouldPromoteModel } from "../ml/modelEvaluator.js";

describe("risk governor and model evaluator", () => {
  it("allows reasonable movement", async () => {
    const res = await riskGovernor.canExecute({ amount: 100, from: "u1" });
    expect(res.ok).toBe(true);
  });

  it("promotes only better models", () => {
    expect(shouldPromoteModel(0.8, 0.81)).toBe(true);
    expect(shouldPromoteModel(0.8, 0.8005)).toBe(false);
  });
});
