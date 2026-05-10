import { claimSettlementJob, processSettlementJob } from "./settlementProcessor.js";

export class SettlementWorker {
  constructor({ workerId, pollIntervalMs = 150, maxRetries = 5, logger = console } = {}) {
    this.workerId = workerId;
    this.pollIntervalMs = pollIntervalMs;
    this.maxRetries = maxRetries;
    this.logger = logger;
    this.running = false;
    this.metrics = { processed: 0, failed: 0, retried: 0, skipped: 0, avgLatency: 0 };
  }

  async tick() {
    const job = await claimSettlementJob({ workerId: this.workerId });
    if (!job) return false;

    const result = await processSettlementJob(job, { workerId: this.workerId, maxRetries: this.maxRetries });
    if (result.skipped) this.metrics.skipped += 1;
    else if (result.ok) this.metrics.processed += 1;
    else {
      this.metrics.failed += 1;
      if (result.retried) this.metrics.retried += 1;
    }

    const total = this.metrics.processed + this.metrics.failed + this.metrics.skipped;
    this.metrics.avgLatency = total === 0 ? 0 : ((this.metrics.avgLatency * (total - 1)) + result.latencyMs) / total;
    return true;
  }

  async start() {
    if (this.running) return;
    this.running = true;
    while (this.running) {
      try {
        const worked = await this.tick();
        if (!worked) await new Promise((r) => setTimeout(r, this.pollIntervalMs));
      } catch (error) {
        this.logger.error("settlement_worker_tick_failed", { workerId: this.workerId, error: error.message });
        await new Promise((r) => setTimeout(r, this.pollIntervalMs));
      }
    }
  }

  stop() {
    this.running = false;
  }
}
