import { eventBus } from "../events/eventBus.js";
import { EVENT_TYPES } from "../events/eventTypes.js";
import { systemState } from "./systemState.js";
import { stateGet, stateSet, stateIncrement } from "./stateStore.js";

const THRESHOLD = Number(process.env.KILL_SWITCH_FRAUD_THRESHOLD || 15);

async function getCount() {
  const s = await stateGet("killSwitch:highRiskCount");
  return Number(s?.count ?? 0);
}

async function trigger(reason) {
  systemState.setMode(systemState.MODES.FREEZE_ALL, reason);
  await stateSet("killSwitch:frozen", { frozen: true, reason, triggeredAt: new Date().toISOString() });
  eventBus.emit(EVENT_TYPES.SYSTEM_EMERGENCY_TRIGGERED, {
    reason,
    timestamp: new Date().toISOString(),
  });
}

export function initKillSwitch() {
  // Restore freeze state that survived a restart
  stateGet("killSwitch:frozen").then((s) => {
    if (s?.frozen) systemState.setMode(systemState.MODES.FREEZE_ALL, s.reason || "restored");
  }).catch(() => {});

  eventBus.on(EVENT_TYPES.FRAUD_ALERT_HIGH_RISK, async () => {
    const newCount = await stateIncrement("killSwitch:highRiskCount", "count", 1);
    if (newCount >= THRESHOLD) {
      await trigger("fraud_spike");
    }
  });
}

export const killSwitch = {
  async trigger(reason = "manual") {
    await trigger(reason);
  },
  async reset() {
    await stateSet("killSwitch:highRiskCount", { count: 0 });
    await stateSet("killSwitch:frozen", { frozen: false });
    systemState.setMode(systemState.MODES.NORMAL, "kill_switch_reset");
  },
};
