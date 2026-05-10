import { getBalance as getLedgerBalance } from "./ledger.service.js";

/* =========================================================
   SINGLE SOURCE OF TRUTH BALANCE ENGINE
========================================================= */

/**
 * Returns balance in CENTS (ledger truth model)
 */
export async function getBalance(userId, currency = "ZAR", client = null) {
  return getLedgerBalance(userId, currency, client || undefined);
}

/**
 * Checks if user has enough funds (ledger-based)
 */
export async function hasSufficientFunds(userId, amount, currency = "ZAR", client = null) {
  const balanceCents = await getBalance(userId, currency, client);
  const amountCents = Math.round(Number(amount) * 100);

  return balanceCents >= amountCents;
}