/**
 * BACKEND-ONLY — NEVER import this from frontend/Vite code.
 *
 * This module holds the Supabase service-role client which bypasses ALL Row
 * Level Security policies. Importing it from any file that Vite bundles would
 * expose the service-role key to the browser.
 *
 * Safe use: Express controllers, middleware, server-side scripts.
 * Unsafe use: src/pages/*, src/components/*, src/lib/hooks/*, src/lib/store.ts
 */

// Hard runtime guard: if this file is somehow loaded in a browser context,
// throw immediately so the leak is caught during development.
if (typeof window !== "undefined") {
  throw new Error(
    "[supabaseAdmin] This module must not be imported in browser code. " +
    "It contains the Supabase service-role key. Use the public `supabase` client instead."
  );
}

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

let _client = null;

export const supabaseAdmin = new Proxy({}, {
  get(_target, prop) {
    if (!_client) {
      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
      if (!url || !key) {
        throw new Error("Missing Supabase env vars. Required: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY");
      }
      _client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    }
    return _client[prop];
  },
});
