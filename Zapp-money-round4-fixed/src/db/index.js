import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

export const db = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX || 10),          // stay well under Supabase's 60-connection limit
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  // Supabase requires SSL in production. The DATABASE_URL includes ?sslmode=require
  // but pg doesn't always honour query-string SSL params without explicit config.
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : false,
});