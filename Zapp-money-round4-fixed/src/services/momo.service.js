/**
 * MTN MoMo Open API service
 * Collections:   requestToPay, getCollectionStatus
 * Disbursements: transfer (payout), deposit, refund, getTransferStatus, getDepositStatus, getRefundStatus, getBalance, validateAccount
 */

import { randomUUID } from "crypto";
import { logger } from "../lib/logger.js";

const BASE_URL          = process.env.MOMO_BASE_URL          || "https://sandbox.momodeveloper.mtn.com";
const TARGET_ENV        = process.env.MOMO_TARGET_ENV        || "sandbox";
const CALLBACK_HOST     = process.env.MOMO_CALLBACK_HOST     || process.env.BACKEND_URL || "http://localhost:3000";

const COLLECTION_SUB    = process.env.MOMO_COLLECTION_SUB_KEY;
const COLLECTION_USER   = process.env.MOMO_COLLECTION_API_USER;
const COLLECTION_PASS   = process.env.MOMO_COLLECTION_API_KEY;

const DISBURSEMENT_SUB  = process.env.MOMO_DISBURSEMENT_SUB_KEY;
const DISBURSEMENT_USER = process.env.MOMO_DISBURSEMENT_API_USER;
const DISBURSEMENT_PASS = process.env.MOMO_DISBURSEMENT_API_KEY;

// ── Token cache ───────────────────────────────────────────────────────────────
const tokenCache = {};

async function fetchToken(product, user, pass, subKey) {
  const cached = tokenCache[product];
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token;

  const res = await fetch(`${BASE_URL}/${product}/token/`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`,
      "Ocp-Apim-Subscription-Key": subKey,
      "Content-Length": "0",
    },
  });

  if (!res.ok) throw new Error(`MoMo token [${product}]: ${res.status} ${await res.text()}`);

  const data = await res.json();
  tokenCache[product] = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

const collectionToken   = () => fetchToken("collection",   COLLECTION_USER,   COLLECTION_PASS,   COLLECTION_SUB);
const disbursementToken = () => fetchToken("disbursement", DISBURSEMENT_USER, DISBURSEMENT_PASS, DISBURSEMENT_SUB);

// ── Shared request helper ─────────────────────────────────────────────────────
async function momoPost(path, body, referenceId, token, subKey, callbackPath) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Reference-Id": referenceId,
      "X-Target-Environment": TARGET_ENV,
      "X-Callback-Url": `${CALLBACK_HOST}/api/v1/webhooks${callbackPath}`,
      "Ocp-Apim-Subscription-Key": subKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (res.status !== 202) throw new Error(`MoMo POST ${path}: ${res.status} ${await res.text()}`);
  return referenceId;
}

async function momoGet(path, token, subKey) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Target-Environment": TARGET_ENV,
      "Ocp-Apim-Subscription-Key": subKey,
    },
  });
  if (!res.ok) throw new Error(`MoMo GET ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

// ── Collections ───────────────────────────────────────────────────────────────

/**
 * Charge a MoMo wallet (top-up). Returns referenceId.
 */
export async function requestToPay({ amount, currency, phone, externalId, note = "Zapp top-up" }) {
  const referenceId = randomUUID();
  const token = await collectionToken();
  logger.info("MoMo requestToPay", { referenceId, phone, amount });
  return momoPost(
    "/collection/v1_0/requesttopay",
    { amount: String(amount), currency, externalId, payer: { partyIdType: "MSISDN", partyId: phone }, payerMessage: note, payeeNote: note },
    referenceId, token, COLLECTION_SUB, "/momo/collection"
  );
}

export async function getCollectionStatus(referenceId) {
  const token = await collectionToken();
  const data = await momoGet(`/collection/v1_0/requesttopay/${referenceId}`, token, COLLECTION_SUB);
  return { status: data.status, reason: data.reason, financialTransactionId: data.financialTransactionId };
}

// ── Disbursements ─────────────────────────────────────────────────────────────

/**
 * Transfer (payout) from MoMo account to a mobile wallet. Returns referenceId.
 */
export async function transfer({ amount, currency, phone, externalId, note = "Zapp payout" }) {
  const referenceId = randomUUID();
  const token = await disbursementToken();
  logger.info("MoMo transfer", { referenceId, phone, amount });
  return momoPost(
    "/disbursement/v1_0/transfer",
    { amount: String(amount), currency, externalId, payee: { partyIdType: "MSISDN", partyId: phone }, payerMessage: note, payeeNote: note },
    referenceId, token, DISBURSEMENT_SUB, "/momo/disbursement"
  );
}

export async function getTransferStatus(referenceId) {
  const token = await disbursementToken();
  const data = await momoGet(`/disbursement/v1_0/transfer/${referenceId}`, token, DISBURSEMENT_SUB);
  return { status: data.status, reason: data.reason, financialTransactionId: data.financialTransactionId };
}

/**
 * Deposit from MoMo owner account to a payee. Returns referenceId.
 */
export async function deposit({ amount, currency, phone, externalId, note = "Zapp deposit" }) {
  const referenceId = randomUUID();
  const token = await disbursementToken();
  logger.info("MoMo deposit", { referenceId, phone, amount });
  return momoPost(
    "/disbursement/v1_0/deposit",
    { amount: String(amount), currency, externalId, payee: { partyIdType: "MSISDN", partyId: phone }, payerMessage: note, payeeNote: note },
    referenceId, token, DISBURSEMENT_SUB, "/momo/deposit"
  );
}

export async function getDepositStatus(referenceId) {
  const token = await disbursementToken();
  const data = await momoGet(`/disbursement/v1_0/deposit/${referenceId}`, token, DISBURSEMENT_SUB);
  return { status: data.status, reason: data.reason, financialTransactionId: data.financialTransactionId };
}

/**
 * Refund a previous collection. Returns referenceId.
 */
export async function refund({ amount, currency, externalId, referenceIdToRefund, note = "Zapp refund" }) {
  const referenceId = randomUUID();
  const token = await disbursementToken();
  logger.info("MoMo refund", { referenceId, referenceIdToRefund, amount });
  return momoPost(
    "/disbursement/v1_0/refund",
    { amount: String(amount), currency, externalId, payerMessage: note, payeeNote: note, referenceIdToRefund },
    referenceId, token, DISBURSEMENT_SUB, "/momo/refund"
  );
}

export async function getRefundStatus(referenceId) {
  const token = await disbursementToken();
  const data = await momoGet(`/disbursement/v1_0/refund/${referenceId}`, token, DISBURSEMENT_SUB);
  return { status: data.status, reason: data.reason, financialTransactionId: data.financialTransactionId };
}

/**
 * Get disbursement account balance.
 */
export async function getDisbursementBalance(currency) {
  const token = await disbursementToken();
  const path = currency
    ? `/disbursement/v1_0/account/balance/${currency}`
    : "/disbursement/v1_0/account/balance";
  return momoGet(path, token, DISBURSEMENT_SUB);
}

/**
 * Validate that a MoMo account holder is active.
 * @param {string} phone  MSISDN
 */
export async function validateAccount(phone) {
  const token = await disbursementToken();
  const data = await momoGet(`/disbursement/v1_0/accountholder/msisdn/${phone}/active`, token, DISBURSEMENT_SUB);
  return data; // true | false
}

// Keep old export name as alias for backwards compat
export const disburse = transfer;
export const getDisbursementStatus = getTransferStatus;
