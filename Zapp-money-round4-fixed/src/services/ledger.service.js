import { db } from "../db/index.js";
import crypto from "crypto";

function generateId(prefix = "txn") {
  return `${prefix}_${crypto.randomUUID()}`;
}

/**
 * @param {number} amount - Amount in major currency units (e.g. ZAR)
 * @returns {number} Amount in cents (integer)
 */
export function toCents(amount) {
  return Math.round(Number(amount) * 100);
}

function sanitize(data) {
  return {
    type:     String(data.type || "").trim(),
    amount:   Number(data.amount),
    currency: (data.currency || "ZAR").toUpperCase(),
    from:     data.from     ? String(data.from)   : null,
    to:       data.to       ? String(data.to)      : null,
    status:   data.status   || "pending",
    risk:     Number(data.risk || 0),
  };
}

function validate(tx) {
  if (!tx.type)                        throw new Error("MISSING_TRANSACTION_TYPE");
  if (!tx.amount || tx.amount <= 0)    throw new Error("INVALID_AMOUNT");
  if (tx.amount > 10_000_000)          throw new Error("AMOUNT_LIMIT_EXCEEDED");
}

/* =========================================================
   CREATE TRANSACTION RECORD
   Tables are created via Supabase migrations, not at runtime.
========================================================= */
/**
 * @param {{ type: string, amount: number, currency?: string, from?: string, to?: string, status?: string, risk?: number }} data
 * @param {string|null} idempotencyKey
 * @param {import('pg').Pool|import('pg').PoolClient} executor
 * @returns {Promise<{ id: string, type: string, amount: number, currency: string, from: string|null, to: string|null, status: string, risk: number }>}
 */
export async function createTransaction(data, idempotencyKey = null, executor = db) {
  const clean = sanitize(data);
  validate(clean);

  if (idempotencyKey) {
    const namespacedKey = `ledger:${idempotencyKey}`;
    const prior = await executor.query(
      "SELECT transaction_id FROM idempotency_keys WHERE key = $1 LIMIT 1",
      [namespacedKey]
    );
    if (prior.rows.length) {
      return { transactionId: prior.rows[0].transaction_id, cached: true };
    }
  }

  const transactionId = generateId();
  const rowId = crypto.randomUUID();

  await executor.query(
    `INSERT INTO wallet_ledger
       (id, transaction_id, type, amount, currency, from_account, to_account, status, risk_score, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`,
    [
      rowId, transactionId,
      clean.type, clean.amount, clean.currency,
      clean.from, clean.to,
      clean.status, clean.risk,
    ]
  );

  if (idempotencyKey) {
    await executor.query(
      `INSERT INTO idempotency_keys (key, transaction_id)
       VALUES ($1,$2) ON CONFLICT (key) DO NOTHING`,
      [`ledger:${idempotencyKey}`, transactionId]
    );
  }

  return { id: transactionId, ...clean };
}

/* =========================================================
   DEBIT — must be called inside a DB transaction (BEGIN/COMMIT)
========================================================= */
/**
 * @param {string} userId
 * @param {number} amount - Major currency units (converted to cents internally)
 * @param {string} transactionId
 * @param {string} currency
 * @param {import('pg').Pool|import('pg').PoolClient} executor
 */
export async function debit(userId, amount, transactionId, currency = "ZAR", executor = db) {
  const cents = toCents(amount);
  if (cents <= 0) throw new Error("INVALID_AMOUNT");
  await executor.query(
    `INSERT INTO wallet_ledger (id, transaction_id, user_id, entry_type, amount, currency)
     VALUES ($1,$2,$3,'DEBIT',$4,$5)`,
    [crypto.randomUUID(), transactionId, userId, cents, currency]
  );
}

/* =========================================================
   CREDIT — must be called inside a DB transaction (BEGIN/COMMIT)
========================================================= */
/**
 * @param {string} userId
 * @param {number} amount - Major currency units (converted to cents internally)
 * @param {string} transactionId
 * @param {string} currency
 * @param {import('pg').Pool|import('pg').PoolClient} executor
 */
export async function credit(userId, amount, transactionId, currency = "ZAR", executor = db) {
  const cents = toCents(amount);
  if (cents <= 0) throw new Error("INVALID_AMOUNT");
  await executor.query(
    `INSERT INTO wallet_ledger (id, transaction_id, user_id, entry_type, amount, currency)
     VALUES ($1,$2,$3,'CREDIT',$4,$5)`,
    [crypto.randomUUID(), transactionId, userId, cents, currency]
  );
}

/* =========================================================
   BALANCE — reads from the backend ledger (audit trail)
========================================================= */
/**
 * @param {string} userId
 * @param {string} currency
 * @param {import('pg').Pool|import('pg').PoolClient} executor
 * @returns {Promise<number>} Balance in cents
 */
export async function getBalance(userId, currency = "ZAR", executor = db) {
  const result = await executor.query(
    `SELECT COALESCE(SUM(
       CASE entry_type
         WHEN 'CREDIT' THEN amount
         WHEN 'DEBIT'  THEN -amount
         ELSE 0
       END
     ), 0) AS balance_cents
     FROM wallet_ledger
     WHERE user_id = $1 AND currency = $2`,
    [userId, currency]
  );
  return Number(result.rows[0]?.balance_cents || 0);
}

/* =========================================================
   DOUBLE-ENTRY ASSERTION
   Ensures debits == credits for a transaction before commit.
========================================================= */
/**
 * @param {string} transactionId
 * @param {import('pg').Pool|import('pg').PoolClient} executor
 * @throws {Error} DOUBLE_ENTRY_MISMATCH if debits !== credits
 */
export async function assertDoubleEntry(transactionId, executor = db) {
  const result = await executor.query(
    `SELECT
       COALESCE(SUM(CASE WHEN entry_type = 'DEBIT'  THEN amount ELSE 0 END), 0) AS debits,
       COALESCE(SUM(CASE WHEN entry_type = 'CREDIT' THEN amount ELSE 0 END), 0) AS credits
     FROM wallet_ledger
     WHERE transaction_id = $1`,
    [transactionId]
  );
  const { debits, credits } = result.rows[0];
  if (Number(debits) !== Number(credits)) {
    throw new Error("DOUBLE_ENTRY_MISMATCH");
  }
}

/* =========================================================
   WALLET RECONCILIATION
   Compares ledger-computed balance against wallets.balance.
   Returns { ok, ledgerCents, walletCents, diffCents }.
   Does NOT auto-correct — callers decide what to do.
========================================================= */
export async function reconcileWallet(userId, currency = "ZAR", executor = db) {
  const ledgerCents = await getBalance(userId, currency, executor);

  const walletResult = await executor.query(
    `SELECT balance FROM wallets WHERE user_id = $1 AND currency = $2 LIMIT 1`,
    [userId, currency]
  );
  const walletCents = Math.round(Number(walletResult.rows[0]?.balance || 0) * 100);
  const diffCents = ledgerCents - walletCents;

  return {
    ok: diffCents === 0,
    ledgerCents,
    walletCents,
    diffCents,
  };
}
