import os from "os";
import { SettlementWorker } from "./SettlementWorker.js";
import { eventBus } from "../events/eventBus.js";
import { EVENT_TYPES } from "../events/eventTypes.js";

// Schema is managed by Supabase migrations — no runtime DDL needed here.

export class SettlementWorkerPool {
  constructor({ concurrency = Math.min(20, Math.max(5, os.cpus().length)), pollIntervalMs = 150, maxRetries = 5, logger = console } = {}) {
    this.concurrency = concurrency;
    this.pollIntervalMs = pollIntervalMs;
    this.maxRetries = maxRetries;
    this.logger = logger;
    this.workers = [];
    this.running = false;
  }

  async init() {
    // Schema is already created by Supabase migrations — nothing to do here.

    eventBus.on(EVENT_TYPES.FRAUD_DECISION_MADE, async ({ payload }) => {
      if (!payload?.transactionId) return;
      const fraudDecision = String(payload.decision || "ALLOW").toUpperCase();
      const risk = Number(payload.risk || 0);
      const metadata = { fraudDecision, risk, confidence: payload.confidence ?? null, updatedAt: new Date().toISOString() };
      const { db } = await import("../db/index.js");
      await db.query(
        `UPDATE settlement_queue
            SET risk_metadata = COALESCE(risk_metadata, '{}'::jsonb) || $1::jsonb,
                updated_at = NOW()
          WHERE transaction_id = $2`,
        [JSON.stringify(metadata), payload.transactionId]
      );
    });

    // Persist FRAUD_BLOCK so the worker's risk_metadata check catches it
    // even if the in-memory fraudState is cold (e.g. after a restart).
    eventBus.on(EVENT_TYPES.FRAUD_BLOCK_TRANSACTION, async ({ transactionId, payload }) => {
      const tid = transactionId || payload?.transactionId;
      if (!tid) return;
      const { db } = await import("../db/index.js");
      await db.query(
        `UPDATE settlement_queue
            SET risk_metadata = COALESCE(risk_metadata, '{}'::jsonb) || $1::jsonb,
                updated_at = NOW()
          WHERE transaction_id = $2`,
        [JSON.stringify({ fraudDecision: "BLOCK", risk: payload?.risk ?? 1, updatedAt: new Date().toISOString() }), tid]
      ).catch((err) => this.logger.error?.("fraud_block_persist_failed", { tid, error: err.message }));
    });
  }

  async start() {
    if (this.running) return;
    this.running = true;
    await this.init();

    for (let i = 0; i < this.concurrency; i += 1) {
      const worker = new SettlementWorker({
        workerId: `settlement-worker-${i + 1}`,
        pollIntervalMs: this.pollIntervalMs,
        maxRetries: this.maxRetries,
        logger: this.logger,
      });
      this.workers.push(worker);
      worker.start();
    }

    this.logger.info("settlement_worker_pool_started", { concurrency: this.concurrency });
  }

  async stop() {
    this.running = false;
    for (const worker of this.workers) worker.stop();
    this.workers = [];
    this.logger.info("settlement_worker_pool_stopped");
  }

  get metrics() {
    return this.workers.reduce((acc, worker) => {
      acc.processed += worker.metrics.processed;
      acc.failed += worker.metrics.failed;
      acc.retried += worker.metrics.retried;
      acc.skipped += worker.metrics.skipped;
      acc.avgLatency += worker.metrics.avgLatency;
      return acc;
    }, { processed: 0, failed: 0, retried: 0, skipped: 0, avgLatency: this.workers.length ? 0 : 0 });
  }
}
