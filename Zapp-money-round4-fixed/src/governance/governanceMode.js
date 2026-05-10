import { stateGet, stateSet } from "./stateStore.js";

export const GOVERNANCE_MODE = {
  STRICT:     "STRICT",
  SIMULATION: "SIMULATION",
  FREEZE_ALL: "FREEZE_ALL",
  READ_ONLY:  "READ_ONLY",
};

const STATE_KEY = "governanceMode:current";

// In-process cache (fast path) — loaded from DB on first use
let _cached = null;

export async function setGovernanceMode(mode) {
  _cached = mode;
  await stateSet(STATE_KEY, { mode });
}

export async function getGovernanceMode() {
  if (_cached !== null) return _cached;
  const stored = await stateGet(STATE_KEY);
  _cached = stored?.mode ?? GOVERNANCE_MODE.STRICT;
  return _cached;
}
