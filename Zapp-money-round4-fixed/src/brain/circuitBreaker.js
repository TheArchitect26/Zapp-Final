import { eventBus } from "../events/eventBus.js";
import { EVENT_TYPES } from "../events/eventTypes.js";
import { stateGet, stateSet } from "../governance/stateStore.js";

const FAILURE_RATE_THRESHOLD = Number(process.env.BRAIN_FAILURE_RATE_THRESHOLD || 0.3);
const FRAUD_SPIKE_THRESHOLD  = Number(process.env.BRAIN_FRAUD_SPIKE_THRESHOLD  || 20);
const WINDOW_MS              = 10 * 60 * 1000; // 10 minutes

let _active = null; // local cache; null = not yet loaded from DB

async function load() {
  if (_active !== null) return;
  const s = await stateGet("circuitBreaker:state");
  _active = s?.active ?? false;
}

async function setActive(next, reason) {
  await load();
  if (_active === next) return;
  _active = next;
  await stateSet("circuitBreaker:state", { active: next, reason, updatedAt: new Date().toISOString() });
  eventBus.emit(next ? EVENT_TYPES.SYSTEM_HALTED : EVENT_TYPES.SYSTEM_RECOVERED, {
    reason,
    timestamp: new Date().toISOString(),
  });
}

async function getWindow(key) {
  const s = await stateGet(key);
  const cutoff = Date.now() - WINDOW_MS;
  return (s?.timestamps ?? []).filter((t) => t >= cutoff);
}

async function appendWindow(key, ts) {
  const window = await getWindow(key);
  window.push(ts);
  // keep only last 500 entries to cap key size
  const trimmed = window.slice(-500);
  await stateSet(key, { timestamps: trimmed });
  return trimmed;
}

export const circuitBreaker = {
  async isActive() {
    await load();
    return _active;
  },

  async forceShadow(reason = "manual") {
    await setActive(true, reason);
  },

  async recordExecutionResult(success) {
    if (!success) {
      const window = await appendWindow("circuitBreaker:failures", Date.now());
      const total  = Math.max(1, window.length + 20);
      if (window.length / total >= FAILURE_RATE_THRESHOLD) {
        await setActive(true, "high_failure_rate");
      }
    }
  },

  async recordFraudSignal() {
    const window = await appendWindow("circuitBreaker:frauds", Date.now());
    if (window.length >= FRAUD_SPIKE_THRESHOLD) {
      await setActive(true, "fraud_spike");
    }
  },

  async evaluateRecovery() {
    await load();
    if (!_active) return;
    const failures = await getWindow("circuitBreaker:failures");
    const frauds   = await getWindow("circuitBreaker:frauds");
    if (
      failures.length === 0 &&
      frauds.length < Math.max(3, Math.floor(FRAUD_SPIKE_THRESHOLD / 4))
    ) {
      await setActive(false, "recovered");
    }
  },
};
