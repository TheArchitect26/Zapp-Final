import { db } from "../../db/index.js";
import { settlementWorkerPool } from "../../settlement/runtime.js";
import { controlPlane } from "../../controlPlane.js";
import { circuitBreaker } from "../../brain/circuitBreaker.js";

export async function getSystemState(req, res, next) {
  try {
    const [queueResult, dlqResult] = await Promise.all([
      db.query("SELECT COUNT(*)::int AS count FROM settlement_queue WHERE status IN ('PENDING','PROCESSING')"),
      db.query("SELECT COUNT(*)::int AS count FROM settlement_dlq"),
    ]);

    return res.json({
      success: true,
      health: "ok",
      queueDepth: queueResult.rows[0]?.count || 0,
      dlqSize: dlqResult.rows[0]?.count || 0,
      activeWorkers: settlementWorkerPool.running ? settlementWorkerPool.workers.length : 0,
      workerMetrics: settlementWorkerPool.metrics,
      systemMode: controlPlane.globalStateStore.critical ? "CRITICAL" : "NORMAL",
      activeCircuits: { global: await circuitBreaker.isActive() },
      healthScore: controlPlane.globalStateStore.healthScore,
    });
  } catch (error) {
    return next(error);
  }
}
