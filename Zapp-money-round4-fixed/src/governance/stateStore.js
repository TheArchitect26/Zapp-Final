/**
 * Lightweight DB-backed key/value store for governance state.
 * Falls back to in-memory if DB is unavailable (e.g. during tests).
 */
import { db } from "../db/index.js";
import { logger } from "../lib/logger.js";

const memoryFallback = new Map();

// Schema owned by migration 20260503000000_security_hardening.sql
// No runtime DDL needed here.
async function ready() {
  // no-op — table created by migration
}

export async function stateGet(key) {
  try {
    await ready();
    const r = await db.query(
      "SELECT value FROM governance_state WHERE key = $1",
      [key]
    );
    return r.rows[0]?.value ?? null;
  } catch {
    logger.warn("[stateStore] DB unavailable — using in-memory fallback. Governance state is NOT shared across instances.");
    return memoryFallback.get(key) ?? null;
  }
}

export async function stateSet(key, value) {
  try {
    await ready();
    await db.query(
      `INSERT INTO governance_state (key, value, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE
         SET value = EXCLUDED.value,
             updated_at = NOW()`,
      [key, JSON.stringify(value)]
    );
  } catch {
    logger.warn("[stateStore] DB unavailable — using in-memory fallback. Governance state is NOT shared across instances.");
    memoryFallback.set(key, value);
  }
}

export async function stateIncrement(key, field, by = 1) {
  try {
    await ready();
    const r = await db.query(
      `INSERT INTO governance_state (key, value, updated_at)
       VALUES ($1, jsonb_build_object($2::text, $3::numeric), NOW())
       ON CONFLICT (key) DO UPDATE
         SET value = jsonb_set(
               governance_state.value,
               ARRAY[$2::text],
               to_jsonb(COALESCE((governance_state.value ->> $2)::numeric, 0) + $3)
             ),
             updated_at = NOW()
       RETURNING value`,
      [key, field, by]
    );
    return Number(r.rows[0]?.value?.[field] ?? by);
  } catch {
    logger.warn("[stateStore] DB unavailable — using in-memory fallback. Governance state is NOT shared across instances.");
    const cur = memoryFallback.get(key) ?? {};
    cur[field] = (cur[field] ?? 0) + by;
    memoryFallback.set(key, cur);
    return cur[field];
  }
}
