/**
 * Database initialization.
 *
 * All schema (tables, indexes, RLS policies) is managed exclusively via
 * Supabase migrations in supabase/migrations/. Runtime DDL has been removed.
 *
 * To apply migrations locally:
 *   npx supabase db push
 *
 * To apply in production:
 *   npx supabase db push --linked
 */
import { db } from "./index.js";
import { logger } from "../lib/logger.js";

export async function initDatabase() {
  await db.query("SELECT 1");
  logger.info("Database connection verified");
}
