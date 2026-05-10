import { describe, it, expect } from "vitest";
import { systemState } from "../governance/systemState.js";
import { systemGovernor } from "../governance/systemGovernor.js";
import { setGovernanceMode, GOVERNANCE_MODE } from "../governance/governanceMode.js";

describe("governance", () => {
  it("switches system mode", () => {
    const ok = systemState.setMode(systemState.MODES.SAFE_MODE, "test");
    expect(ok).toBe(true);
    expect(systemState.getMode()).toBe(systemState.MODES.SAFE_MODE);
    systemState.setMode(systemState.MODES.NORMAL, "reset");
  });

  it("blocks execution in freeze mode", async () => {
    await setGovernanceMode(GOVERNANCE_MODE.FREEZE_ALL);
    const res = await systemGovernor.canExecute({ amount: 100, risk: 0.1, type: "brain_move" });
    expect(res.ok).toBe(false);
    await setGovernanceMode(GOVERNANCE_MODE.STRICT);
  });
});
