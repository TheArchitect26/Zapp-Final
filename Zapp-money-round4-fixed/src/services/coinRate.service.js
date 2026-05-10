import { supabaseAdmin } from "../lib/supabaseAdmin.js";

const CACHE_TTL_MS = 60_000;
/** @type {Map<string, { rate: object, ts: number }>} */
const cache = new Map();

/**
 * @param {string} currencyCode
 * @returns {Promise<{ zc_per_unit: number, symbol: string, min_withdrawal_zc: number, display_decimals: number }>}
 */
export async function getRate(currencyCode) {
  const code = currencyCode.toUpperCase();
  const cached = cache.get(code);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.rate;

  const { data, error } = await supabaseAdmin
    .from("coin_exchange_rates")
    .select("zc_per_unit, symbol, min_withdrawal_zc, display_decimals")
    .eq("currency_code", code)
    .eq("active", true)
    .single();

  if (error || !data) throw new Error(`UNKNOWN_CURRENCY:${code}`);

  const rate = {
    zc_per_unit:       Number(data.zc_per_unit),
    symbol:            data.symbol,
    min_withdrawal_zc: data.min_withdrawal_zc,
    display_decimals:  data.display_decimals,
  };
  cache.set(code, { rate, ts: Date.now() });
  return rate;
}

/** Force-expire a cached rate (call after admin update). */
export function invalidateRateCache(currencyCode) {
  cache.delete(currencyCode.toUpperCase());
}

/**
 * @param {number} zcAmount  integer ZC
 * @param {string} currencyCode
 */
export async function zcToFiat(zcAmount, currencyCode) {
  const rate = await getRate(currencyCode);
  return {
    amount:   zcAmount / rate.zc_per_unit,
    currency: currencyCode.toUpperCase(),
    symbol:   rate.symbol,
  };
}

/**
 * @param {number} fiatAmount
 * @param {string} currencyCode
 * @returns {Promise<number>} integer ZC
 */
export async function fiatToZc(fiatAmount, currencyCode) {
  const rate = await getRate(currencyCode);
  return Math.round(fiatAmount * rate.zc_per_unit);
}

/**
 * @param {string} userId
 * @returns {Promise<string>} currency_code
 */
export async function getUserCurrency(userId) {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("currency_code")
    .eq("user_id", userId)
    .single();
  return data?.currency_code || "ZAR";
}
