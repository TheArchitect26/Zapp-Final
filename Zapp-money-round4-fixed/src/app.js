import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import { logger } from "./lib/logger.js";
import { requireAuth, requireAdmin } from "./middleware/auth.js";
import { validateEnv } from "./config/env.js";

// Validate required env vars at startup — fails fast before any request is served.
// server.js also calls this, but importing app.js directly (e.g. in tests) must also validate.
if (process.env.NODE_ENV !== "test") {
  validateEnv();
}

/* =========================================================
   OPTIONAL API LAYER (SAFE IMPORTS)
========================================================= */
let transactionsRoutes, systemRoutes, replayRoutes;

try {
  transactionsRoutes = (await import("./api/routes/transactions.routes.js")).default;
} catch {
  logger.warn("transactions.routes.js not found");
}
try {
  systemRoutes = (await import("./api/routes/system.routes.js")).default;
} catch {
  logger.warn("system.routes.js not found");
}
try {
  replayRoutes = (await import("./api/routes/replay.routes.js")).default;
} catch {
  logger.warn("replay.routes.js not found");
}

import paymentsRoutes  from "./routes/payments.routes.js";
import transferRoutes  from "./routes/transfer.routes.js";
import walletRoutes    from "./routes/wallet.routes.js";
import aiRoutes        from "./routes/ai.routes.js";
import webhooksRoutes  from "./routes/webhooks.routes.js";
import earnWebhookRoutes from "./routes/earnWebhook.routes.js";
import customersRoutes from "./routes/customers.routes.js";
import withdrawRoutes  from "./routes/withdraw.routes.js";
import topupRoutes     from "./routes/topup.routes.js";
import kycRoutes from "./routes/kyc.routes.js";
import pushRoutes     from "./routes/push.routes.js";
import adminRoutes     from "./routes/admin.routes.js";
import earnRoutes      from "./routes/earn.routes.js";

const app = express();

/* =========================================================
   SECURITY HEADERS
========================================================= */
app.use(helmet());

/* =========================================================
   CORS — locked to configured frontend origins
========================================================= */
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin '${origin}' not allowed`));
      }
    },
    credentials: true,
  })
);

/* =========================================================
   WEBHOOK ROUTES — registered BEFORE express.json() so the
   route can capture the raw request body for HMAC verification.
   The route handles its own body parsing internally.

   ⚠️  WARNING: Do NOT register any other routes above this line.
   Routes mounted before express.json() will receive req.body = undefined
   unless they use their own body parser (like captureRawBody does).
========================================================= */
// earnWebhookRoutes MUST be mounted before webhooksRoutes — Express matches
// /api/v1/webhooks first and would shadow /api/v1/webhooks/earn otherwise.
app.use("/api/v1/webhooks/earn", earnWebhookRoutes);
app.use("/api/v1/webhooks", webhooksRoutes);

app.use(express.json({ limit: "10kb" }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

/* =========================================================
   GLOBAL RATE LIMITER
========================================================= */
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "RATE_LIMIT_EXCEEDED" },
});
app.use(globalLimiter);

/* =========================================================
   PER-USER RATE LIMITER for financial endpoints
========================================================= */
const financialLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator(req) {
    return req.user?.id || req.ip;
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "FINANCIAL_RATE_LIMIT_EXCEEDED" },
});

/* =========================================================
   HEALTH CHECK (public)
========================================================= */
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "zapp-money-backend" });
});

/* =========================================================
   PROTECTED ROUTES — require valid Supabase JWT
========================================================= */
app.use("/api/v1/payments",     requireAuth, financialLimiter, paymentsRoutes);
app.use("/api/v1/transfer",     requireAuth, financialLimiter, transferRoutes);
app.use("/api/v1/withdraw",     requireAuth, financialLimiter, withdrawRoutes);
app.use("/api/v1/topup",        requireAuth, financialLimiter, topupRoutes);
app.use("/api/v1/earn",         requireAuth, financialLimiter, earnRoutes);
app.use("/api/v1/kyc",          requireAuth, financialLimiter, kycRoutes);
app.use("/api/v1/push",         requireAuth, pushRoutes);
app.use("/api/v1/wallet",       requireAuth, walletRoutes);
app.use("/api/v1/ai",           requireAuth, aiRoutes);
app.use("/api/v1/customers",    requireAuth, customersRoutes);
app.use("/api/v1/admin",        requireAuth, requireAdmin, adminRoutes);

if (transactionsRoutes)
  app.use("/api/v1/transactions", requireAuth, financialLimiter, transactionsRoutes);
if (systemRoutes)
  app.use("/api/v1/system", requireAuth, systemRoutes);
if (replayRoutes)
  app.use("/api/v1/replay", requireAuth, replayRoutes);

app.get("/", (_req, res) => {
  res.json({ name: "Zapp Money OS", status: "ONLINE" });
});

/* =========================================================
   VAPID KEY VALIDATION
========================================================= */
if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
  logger.warn("VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set — push notifications disabled");
}

/* =========================================================
   ERROR HANDLER — never leaks internals in production
========================================================= */
app.use((err, req, res, _next) => {
  logger.error("SYSTEM ERROR", { message: err.message, stack: err.stack });
  const isDev = process.env.NODE_ENV === "development";
  res.status(err.status || 500).json({
    success: false,
    error: "INTERNAL_SERVER_ERROR",
    message: isDev ? err.message : "Something went wrong",
  });
});

app.use((_req, res) => {
  res.status(404).json({ success: false, error: "ROUTE_NOT_FOUND" });
});

export default app;
