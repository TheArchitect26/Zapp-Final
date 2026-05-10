/**
 * safeInit / safeInitAsync
 *
 * Wraps subsystem initialization functions so that a failure in one module
 * (e.g. a missing DB table, an unavailable external service, a bad config)
 * does NOT crash the entire server.
 *
 * Usage:
 *   safeInit("Socket Server", () => initSocket(httpServer));
 *   await safeInitAsync("Settlement Pool", () => settlementWorkerPool.start());
 */
import { logger } from "./logger.js";

/**
 * Synchronous init wrapper. Also handles functions that return a Promise
 * (fires-and-forgets the async portion without blocking startup).
 */
export function safeInit(name, fn) {
  try {
    const result = fn();
    if (result instanceof Promise) {
      result
        .then(() => logger.init(name, true))
        .catch((err) => logger.init(name, false, err));
    } else {
      logger.init(name, true);
    }
  } catch (err) {
    logger.init(name, false, err);
  }
}

/**
 * Async init wrapper. Awaits the function and logs success or failure.
 * Server startup awaits this, so use it only for truly sequential inits.
 */
export async function safeInitAsync(name, fn) {
  try {
    await fn();
    logger.init(name, true);
  } catch (err) {
    logger.init(name, false, err);
  }
}
