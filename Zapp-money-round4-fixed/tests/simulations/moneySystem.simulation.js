import { setGovernanceMode, GOVERNANCE_MODE } from "../../src/governance/systemGovernor.js";
import { initDatabase } from "../../src/db/init.js";
import { MoneyEngine } from "../../src/core/moneyEngine.js";
import { db } from "../../src/db/index.js";
import { eventBus } from "../../src/events/eventBus.js";

/* =========================================================
   INIT
========================================================= */
setGovernanceMode(GOVERNANCE_MODE.SIMULATION);
await initDatabase();

/* =========================================================
   CONFIG
========================================================= */
const USERS = ["alice", "bob", "charlie", "dave"];
const CURRENCIES = ["USD", "ZAR"];

const RANDOM = {
  amount: () => Math.floor(Math.random() * 5000) + 1,
  user: () => USERS[Math.floor(Math.random() * USERS.length)],
  currency: () => CURRENCIES[Math.floor(Math.random() * CURRENCIES.length)],
};

/* =========================================================
   UTILS
========================================================= */
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const randomIdempotencyKey = () =>
  `key_${Math.random().toString(36).slice(2, 12)}`;

/* =========================================================
   METRICS
========================================================= */
const metrics = {
  created: 0,
  settled: 0,
  failed: 0,
  blocked: 0,
  duplicates: 0,
};

/* =========================================================
   EVENT MONITORING
========================================================= */
eventBus.on("FRAUD_BLOCK_TRANSACTION", () => {
  metrics.blocked++;
});

eventBus.on("SETTLEMENT_COMPLETED", (e) => {
  if (e.status === "SETTLED") metrics.settled++;
  if (e.status === "FAILED") metrics.failed++;
});

/* =========================================================
   TRANSACTION CREATION
========================================================= */
async function createRandomTransaction() {
  const from = RANDOM.user();
  const to = RANDOM.user();

  if (from === to) return null;

  const data = {
    type: "transfer",
    amount: RANDOM.amount(),
    currency: RANDOM.currency(),
    from,
    to,
    risk: Math.random(),
  };

  const idempotencyKey =
    Math.random() > 0.7 ? randomIdempotencyKey() : null;

  try {
    const result = await MoneyEngine.createTransaction(
      data,
      idempotencyKey
    );

    metrics.created++;
    return result;
  } catch (err) {
    if (String(err.message).includes("GOVERNANCE_BLOCK")) {
      metrics.blocked++;
    } else {
      metrics.failed++;
    }
    return null;
  }
}

/* =========================================================
   CONCURRENT STRESS TEST
========================================================= */
async function runConcurrentTransactions(count = 100) {
  const tasks = [];

  for (let i = 0; i < count; i++) {
    tasks.push(createRandomTransaction());
  }

  await Promise.all(tasks);
}

/* =========================================================
   IDEMPOTENCY TEST
========================================================= */
async function runIdempotencyTest() {
  const key = "STATIC_KEY_123";

  const data = {
    type: "transfer",
    amount: 100,
    currency: "USD",
    from: "alice",
    to: "bob",
    risk: 0.2,
  };

  const r1 = await MoneyEngine.createTransaction(data, key);
  const r2 = await MoneyEngine.createTransaction(data, key);

  if (r1?.transaction?.id === r2?.transaction?.id) {
    metrics.duplicates++;
  }
}

/* =========================================================
   FRAUD STRESS TEST
========================================================= */
async function runFraudStressTest() {
  for (let i = 0; i < 20; i++) {
    await MoneyEngine.createTransaction({
      type: "transfer",
      amount: 9999,
      currency: "USD",
      from: "alice",
      to: "bob",
      risk: 0.95,
    });

    await delay(20);
  }
}

/* =========================================================
   SETTLEMENT LOOP
========================================================= */
async function runSettlementLoop(iterations = 10) {
  for (let i = 0; i < iterations; i++) {
    const txs = await db.query(
      `SELECT transaction_id FROM settlement_queue WHERE status = 'PENDING' LIMIT 20`
    );

    for (const tx of txs.rows) {
      await MoneyEngine.settleTransaction(tx.transaction_id);
    }

    await delay(100);
  }
}

/* =========================================================
   FULL SIMULATION
========================================================= */
async function runSimulation() {
  console.log("🚀 Starting Money System Simulation...");

  await runConcurrentTransactions(100);
  await runIdempotencyTest();
  await runFraudStressTest();
  await runSettlementLoop(15);

  console.log("\n📊 FINAL METRICS:");
  console.table(metrics);

  const ledgerCheck = await db.query(`
    SELECT
      SUM(CASE WHEN entry_type='DEBIT' THEN amount ELSE 0 END) AS debits,
      SUM(CASE WHEN entry_type='CREDIT' THEN amount ELSE 0 END) AS credits
    FROM ledger_entries
  `);

  console.log("\n🧾 LEDGER CHECK:");
  console.table(ledgerCheck.rows);

  const debits = Number(ledgerCheck.rows[0]?.debits || 0);
  const credits = Number(ledgerCheck.rows[0]?.credits || 0);

  if (debits !== credits) {
    console.log("❌ DOUBLE ENTRY FAILURE DETECTED");
  } else {
    console.log("✅ DOUBLE ENTRY BALANCED");
  }

  console.log("\n🏁 Simulation Complete");
}

/* =========================================================
   EXECUTE
========================================================= */
runSimulation().catch((err) => {
  console.error("Simulation crashed:", err);
});