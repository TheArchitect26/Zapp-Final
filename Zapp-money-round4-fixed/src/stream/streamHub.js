import { eventBus } from "../events/eventBus.js";
import { EVENT_TYPES } from "../events/eventTypes.js";
import { logger } from "../lib/logger.js";

const MIN_BATCH_SIZE = 5;
const MAX_BATCH_SIZE = 50;
const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_MAX_QUEUE = 5000;

export class StreamHub {
  constructor({ handler, batchSize = DEFAULT_BATCH_SIZE, maxQueueSize = DEFAULT_MAX_QUEUE } = {}) {
    this.handler = handler;
    this.batchSize = Math.max(MIN_BATCH_SIZE, Math.min(MAX_BATCH_SIZE, batchSize));
    this.maxQueueSize = Math.max(MAX_BATCH_SIZE, maxQueueSize);
    this.queue = [];
    this.processing = false;
    this.droppedEvents = 0;
  }

  enqueue(packet) {
    if (this.queue.length >= this.maxQueueSize) {
      this.queue.shift();
      this.droppedEvents += 1;
      eventBus.emit(EVENT_TYPES.STREAM_BACKPRESSURE, {
        droppedEvents: this.droppedEvents,
        maxQueueSize: this.maxQueueSize,
      });
    }

    this.queue.push(packet);
    this.schedule();
  }

  schedule() {
    if (this.processing) return;
    this.processing = true;

    setImmediate(async () => {
      while (this.queue.length) {
        const batch = this.queue.splice(0, this.batchSize);
        try {
          await this.handler(batch);
        } catch (error) {
          logger.error("stream batch handler failed", { error: error.message });
        }
      }

      this.processing = false;
    });
  }
}
