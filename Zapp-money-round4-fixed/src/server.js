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
  // Validate env vars before opening the port — fail fast before accepting traffic.
  validateEnv();

  // Start listening after validation so /health is reachable during the rest of startup.
  await new Promise((resolve) => server.listen(PORT, resolve));
  logger.info("Zapp Money backend listening", {
    port: PORT,
    env: process.env.NODE_ENV || "development",
  });

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
  // Stop accepting new connections, then wait for in-flight requests to finish.
  server.close(() => process.exit(0));
  // closeAllConnections() is available in Node 18.2+ and forcibly closes idle
  // keep-alive connections so server.close() resolves promptly.
  if (typeof server.closeAllConnections === "function") {
    server.closeAllConnections();
  }
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
