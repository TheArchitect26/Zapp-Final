import fs from "fs";
import path from "path";

const folders = [
  "src",
  "src/routes",
  "src/services",
  "src/store",
  "src/middleware",
];

const files = {
  "src/app.js": `
import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

export default app;
`,

  "src/server.js": `
import app from "./app.js";
import customerRoutes from "./routes/customers.routes.js";
import paymentRoutes from "./routes/payments.routes.js";
import aiRoutes from "./routes/ai.routes.js";
import webhookRoutes from "./routes/webhooks.routes.js";

const PORT = 3000;

app.use(customerRoutes);
app.use(paymentRoutes);
app.use(aiRoutes);
app.use(webhookRoutes);

app.get("/", (req, res) => {
  res.json({
    status: "STRIPE PRO v4 ONLINE",
    engine: "modular fintech core active"
  });
});

app.listen(PORT, () => {
  console.log("🚀 Stripe Pro v4 running on port " + PORT);
});
`,

  "src/store/memory.db.js": `
export const db = {
  customers: [],
  transactions: []
};
`,

  "src/routes/customers.routes.js": `
import express from "express";
import { db } from "../store/memory.db.js";

const router = express.Router();

router.post("/customers", (req, res) => {
  const customer = {
    id: "cus_" + Date.now(),
    ...req.body,
    createdAt: new Date()
  };

  db.customers.push(customer);

  res.json({ success: true, customer });
});

router.get("/customers", (req, res) => {
  res.json({ count: db.customers.length, data: db.customers });
});

export default router;
`,

  "src/routes/payments.routes.js": `
import express from "express";
import { db } from "../store/memory.db.js";

const router = express.Router();

router.post("/charge", (req, res) => {
  const { amount, currency = "USD", customerId } = req.body;

  const tx = {
    id: "txn_" + Date.now(),
    amount,
    currency,
    customerId,
    type: "charge",
    status: "succeeded",
    createdAt: new Date()
  };

  db.transactions.push(tx);

  res.json({ success: true, transaction: tx });
});

router.post("/refund", (req, res) => {
  const { transactionId } = req.body;

  const tx = db.transactions.find(t => t.id === transactionId);

  if (!tx) return res.status(404).json({ error: "Not found" });

  const refund = {
    id: "ref_" + Date.now(),
    originalTransaction: transactionId,
    amount: tx.amount,
    type: "refund",
    status: "succeeded",
    createdAt: new Date()
  };

  db.transactions.push(refund);

  res.json({ success: true, refund });
});

router.get("/transactions", (req, res) => {
  res.json(db.transactions);
});

export default router;
`,

  "src/routes/ai.routes.js": `
import express from "express";
import axios from "axios";

const router = express.Router();

router.post("/ai-test", async (req, res) => {
  try {
    const { cost, speed, reliability, liquidity } = req.body;

    const response = await axios.post("http://localhost:4000/score-route", {
      cost,
      speed,
      reliability,
      liquidity
    });

    res.json({
      success: true,
      ai_score: response.data.score
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
`,

  "src/routes/webhooks.routes.js": `
import express from "express";

const router = express.Router();

router.post("/webhook", (req, res) => {
  console.log("WEBHOOK:", req.body.type);
  res.json({ received: true });
});

export default router;
`
};

// create folders
folders.forEach(f => {
  if (!fs.existsSync(f)) {
    fs.mkdirSync(f, { recursive: true });
  }
});

// create files
Object.entries(files).forEach(([filePath, content]) => {
  fs.writeFileSync(filePath, content.trim());
});

console.log("🚀 STRIPE PRO v4 STRUCTURE CREATED SUCCESSFULLY");