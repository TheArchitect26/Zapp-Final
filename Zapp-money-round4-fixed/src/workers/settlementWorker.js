import { SettlementWorkerPool } from "../settlement/SettlementWorkerPool.js";
import { logger } from "../lib/logger.js";

const pool = new SettlementWorkerPool({
  concurrency: Number(process.env.SETTLEMENT_WORKER_CONCURRENCY || 8),
  pollIntervalMs: Number(process.env.SETTLEMENT_POLL_INTERVAL_MS || 150),
  maxRetries: Number(process.env.SETTLEMENT_MAX_RETRIES || 5),
});

pool.start().catch((error) => {
  logger.error("settlement_worker_pool_fatal", { error: error.message });
  process.exitCode = 1;
});

const shutdown = async () => {
  await pool.stop();
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

export default pool;
