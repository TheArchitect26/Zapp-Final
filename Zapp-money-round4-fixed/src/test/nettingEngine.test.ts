import { describe, it, expect } from "vitest";
import { addPosition, clearPositions } from "../settlement/positionStore.js";
import { calculateNetPositions } from "../settlement/nettingEngine.js";

describe("netting engine", () => {
  it("nets bilateral positions", () => {
    clearPositions();
    addPosition("A", "B", "USD", 5000000);
    addPosition("B", "A", "USD", 3000000);
    const net = calculateNetPositions();
    expect(net.length).toBe(1);
    expect(net[0].from).toBe("A");
    expect(net[0].to).toBe("B");
    expect(net[0].amount).toBe(2000000);
  });
});
