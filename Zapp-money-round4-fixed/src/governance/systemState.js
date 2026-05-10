import { eventBus } from "../events/eventBus.js";
import { EVENT_TYPES } from "../events/eventTypes.js";

const MODES = Object.freeze({
  NORMAL: "NORMAL",
  SAFE_MODE: "SAFE_MODE",
  FREEZE_ALL: "FREEZE_ALL",
  READ_ONLY: "READ_ONLY",
});

let currentMode = MODES.NORMAL;

export const systemState = {
  MODES,
  getMode() {
    return currentMode;
  },
  setMode(nextMode, reason = "manual") {
    if (!Object.values(MODES).includes(nextMode)) return false;
    if (currentMode === nextMode) return true;
    currentMode = nextMode;
    eventBus.emit(EVENT_TYPES.SYSTEM_MODE_CHANGED, { mode: nextMode, reason, timestamp: new Date().toISOString() });
    return true;
  },
};
