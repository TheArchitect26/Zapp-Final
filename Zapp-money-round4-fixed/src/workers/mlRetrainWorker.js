import { db } from "../db/index.js";
import { spawn } from "child_process";
import { shouldPromoteModel } from "../ml/modelEvaluator.js";
import { logger } from "../lib/logger.js";

let workerStarted = false;

function runTrainer() {
  return new Promise((resolve) => {
    const proc = spawn("python3", ["ml/train_model.py"], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    proc.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    proc.stderr.on("data", (chunk) => { logger.warn("ml trainer stderr", { output: chunk.toString().trim() }); });
    proc.on("close", (code) => {
      if (code !== 0) return resolve(null);
      try {
        const parsed = JSON.parse(stdout.trim().split("\n").filter(Boolean).pop());
        resolve(parsed);
      } catch {
        resolve(null);
      }
    });
  });
}

async function ensureModelTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS ml_models (
      id BIGSERIAL PRIMARY KEY,
      version TEXT NOT NULL,
      path TEXT NOT NULL,
      accuracy DOUBLE PRECISION NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
}

export function startMlRetrainWorker({ intervalMs = 10 * 60 * 1000, minRows = 1000 } = {}) {
  if (workerStarted) return;
  workerStarted = true;

  const tick = async () => {
    try {
      await ensureModelTable();
      const countRes = await db.query(`SELECT COUNT(*)::int AS total FROM ml_training_data`);
      const total = countRes.rows[0]?.total || 0;
      if (total < minRows) return;

      const trained = await runTrainer();
      if (!trained) return;

      const best = await db.query(`SELECT accuracy FROM ml_models ORDER BY accuracy DESC LIMIT 1`);
      const bestAcc = Number(best.rows[0]?.accuracy || 0);
      const newAcc = Number(trained.accuracy || 0);

      if (shouldPromoteModel(bestAcc, newAcc)) {
        await db.query(
          `INSERT INTO ml_models (version, path, accuracy) VALUES ($1, $2, $3)`,
          [trained.version || `fraud-model-${Date.now()}`, trained.json || "models/fraud_model.json", newAcc]
        );
      } else {
        logger.warn("New model did not beat best accuracy", { newAcc, bestAcc });
      }
    } catch (error) {
      logger.error("ml retrain worker error", { error: error.message });
    }
  };

  setInterval(() => {
    tick().catch((error) => logger.error("ml retrain tick failure", { error: error.message }));
  }, intervalMs);
}
