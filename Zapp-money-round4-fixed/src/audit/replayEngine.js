import { db } from "../db/index.js";

export async function replayEventStream(limit = 5000) {
  const res = await db.query(
    `SELECT type, payload, created_at FROM event_stream ORDER BY created_at ASC LIMIT $1`,
    [limit]
  );

  const balances = new Map();
  const state = { transactions: 0, settlements: 0, fraudAlerts: 0 };

  for (const row of res.rows) {
    const payload = row.payload || {};
    if (row.type === "transaction.created") {
      state.transactions += 1;
      const from = payload.from;
      const to = payload.to;
      const amount = Number(payload.amount || 0);
      if (from) balances.set(from, (balances.get(from) || 0) - amount);
      if (to) balances.set(to, (balances.get(to) || 0) + amount);
    }
    if (row.type === "settlement.completed") state.settlements += 1;
    if (row.type === "fraud.alert.high_risk") state.fraudAlerts += 1;
  }

  return { state, balances: Object.fromEntries(balances) };
}
