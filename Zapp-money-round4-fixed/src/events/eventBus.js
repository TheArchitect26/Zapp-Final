import { EventEmitter } from "events";
import { logEvent } from "./eventLogger.js";
import { logger } from "../lib/logger.js";
import { EVENT_TYPES } from "./eventTypes.js";

// Set of all valid event type values for O(1) lookup
const VALID_EVENTS = new Set(Object.values(EVENT_TYPES));

// Events that MUST be delivered synchronously before the call returns
// (fraud blocks must be visible to the settlement gate immediately)
const SYNC_EVENTS = new Set([
  EVENT_TYPES.FRAUD_BLOCK_TRANSACTION,
  EVENT_TYPES.FRAUD_DECISION_MADE,
  EVENT_TYPES.SYSTEM_HALTED,
]);

class EventBus {
  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(50);
    this.redisPublisher = null;
  }

  setRedisPublisher(publisher) {
    this.redisPublisher = publisher;
  }

  on(type, handler) {
    if (!VALID_EVENTS.has(type)) {
      throw new Error(`EventBus.on: unknown event type "${type}"`);
    }
    this.emitter.on(type, handler);
  }

  /**
   * Emit an event.
   * - Validates the event type at runtime — throws on unknown types.
   * - SYNC_EVENTS are dispatched synchronously so fraud blocks are visible
   *   to the settlement gate before the awaited call returns.
   * - All other events are dispatched via setImmediate (non-blocking).
   */
  emit(type, payload = {}, options = {}) {
    if (!VALID_EVENTS.has(type)) {
      const err = new Error(`EventBus.emit: unknown event type "${type}"`);
      logger.error("EventBus unknown event type", { type, error: err.message });
      throw err;
    }

    const event = {
      type,
      payload,
      transactionId: options.transactionId || payload.transactionId || null,
      ts: Date.now(),
    };

    const dispatch = () => {
      this.emitter.emit(type, event);

      logEvent(event).catch((error) => {
        logger.error("event_stream insert failed", { type, error: error.message });
      });

      if (this.redisPublisher?.publish) {
        this.redisPublisher
          .publish(type, JSON.stringify(event))
          .catch((error) => logger.error("redis publish failed", { type, error: error.message }));
      }
    };

    if (SYNC_EVENTS.has(type)) {
      dispatch();
    } else {
      setImmediate(dispatch);
    }
  }
}

export const eventBus = new EventBus();
