import { getGovernanceMode, GOVERNANCE_MODE } from "./governance/governanceMode.js";

const globalStateStore = {
  splitBrain: false,
  ledgerImbalance: false,
  critical: false,
  healthScore: 1,
  set(partial = {}) { Object.assign(this, partial); },
};

const policyEngine = {
  async allow(action) {
    const mode = await getGovernanceMode();
    if (mode === GOVERNANCE_MODE.FREEZE_ALL) return { ok: false, reason: "MODE_FREEZE_ALL" };
    if (mode === GOVERNANCE_MODE.READ_ONLY && action !== "read") return { ok: false, reason: "MODE_READ_ONLY" };
    return { ok: true };
  },
};

const invariantGuard = {
  check(action) {
    if (action === "settlement" && globalStateStore.ledgerImbalance) return { ok: false, reason: "LEDGER_IMBALANCE" };
    if (action === "consensus" && globalStateStore.splitBrain) return { ok: false, reason: "SPLIT_BRAIN" };
    if (action === "replay" && globalStateStore.critical) return { ok: false, reason: "SYSTEM_CRITICAL" };
    return { ok: true };
  },
};

export const controlPlane = {
  globalStateStore,
  policyEngine,
  invariantGuard,
  async assert(action) {
    const policy = await policyEngine.allow(action);
    if (!policy.ok) throw new Error(`POLICY_BLOCK:${policy.reason}`);
    const inv = invariantGuard.check(action);
    if (!inv.ok) throw new Error(`INVARIANT_BLOCK:${inv.reason}`);
  },
};
