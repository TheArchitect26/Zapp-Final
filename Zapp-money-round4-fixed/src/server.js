import { createServer } from "http";
import app from "./app.js";
import { validateEnv } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { initSocket } from "./realtime/socket.server.js";
import { initDatabase } from "./db/init.js";
import { initBrainOrchestrator } from "./brain/brainOrchestrator.js";
import { initDecisionAuditor } from "./brain/decisionAuditor.js";
import { initSettlementScheduler } from "./settlement/settlementScheduler.js";

const PORT = Number(process.env.PORT || 3000);

const server = createServer(app);

initSocket(server);

async function start() {
  // Start listening first so /health is reachable during startup
  await new Promise((resolve) => server.listen(PORT, resolve));
  logger.info("Zapp Money backend listening", {
    port: PORT,
    env: process.env.NODE_ENV || "development",
  });

  // Validate env vars after server is up — crash here still lets healthcheck pass
  // during the window before Railway marks the deploy failed
  validateEnv();

  await initDatabase();
  initDecisionAuditor();
  initBrainOrchestrator();
  initSettlementScheduler({
    intervalMs: Number(process.env.SETTLEMENT_POLL_INTERVAL_MS || 60_000),
  });

  logger.info("Zapp Money backend fully started");
}

start().catch((err) => {
  logger.error("Server startup failed: " + err.message, { stack: err.stack });
  process.exit(1);
});

const shutdown = async () => {
  logger.info("Shutting down...");
  server.close(() => process.exit(0));
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
