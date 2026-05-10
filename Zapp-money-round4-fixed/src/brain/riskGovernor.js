import { stateGet, stateIncrement } from "../governance/stateStore.js";

const MAX_DAILY_SYSTEM_MOVEMENT = Number(process.env.MAX_DAILY_SYSTEM_MOVEMENT || 1_000_000);
const MAX_PER_USER_MOVEMENT     = Number(process.env.MAX_PER_USER_MOVEMENT || 100_000);

function dayKey() {
  return new Date().toISOString().slice(0, 10);
}

export const riskGovernor = {
  async canExecute(decision) {
    const amount = Number(decision?.amount || 0);
    const user   = decision?.from || decision?.entityId || "unknown";
    const key    = dayKey();

    const systemState = await stateGet(`riskGov:system:${key}`) ?? { moved: 0 };
    const userState   = await stateGet(`riskGov:user:${key}:${user}`) ?? { moved: 0 };

    if (Number(systemState.moved) + amount > MAX_DAILY_SYSTEM_MOVEMENT) {
      return { ok: false, reason: "MAX_DAILY_SYSTEM_MOVEMENT_EXCEEDED" };
    }
    if (Number(userState.moved) + amount > MAX_PER_USER_MOVEMENT) {
      return { ok: false, reason: "MAX_PER_USER_MOVEMENT_EXCEEDED" };
    }

    return { ok: true, reason: "OK" };
  },

  async registerExecution(decision) {
    const amount = Number(decision?.amount || 0);
    const user   = decision?.from || decision?.entityId || "unknown";
    const key    = dayKey();

    await stateIncrement(`riskGov:system:${key}`, "moved", amount);
    await stateIncrement(`riskGov:user:${key}:${user}`, "moved", amount);
  },
};
