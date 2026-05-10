/**
 * Bounded per-user in-process throttle for THROTTLE-enforcement fraud decisions.
 * Capped at MAX_ENTRIES to prevent unbounded memory growth.
 */
const MAP = new Map();
const MAX_ENTRIES = 10_000;
const WINDOW_MS = 60_000;
const MAX_REQ = 3;

/**
 * Returns true if the user has exceeded the throttle limit for this window.
 * @param {string} userId
 * @returns {boolean}
 */
export function checkThrottle(userId) {
  const now = Date.now();
  const entry = MAP.get(userId);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    if (!MAP.has(userId) && MAP.size >= MAX_ENTRIES) {
      MAP.delete(MAP.keys().next().value);
    }
    MAP.set(userId, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_REQ;
}
