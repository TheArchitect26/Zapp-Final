/**
 * @deprecated Use `src/lib/supabaseAdmin.js` instead (server-side only).
 * This file is kept only for backwards compatibility with any scripts in lib/*.
 * It must NEVER be imported from Vite-bundled frontend code.
 */

if (typeof window !== "undefined") {
  throw new Error(
    "[supabaseAdmin] This module must not be imported in browser code. " +
    "It contains the Supabase service-role key."
  );
}

// Re-export from the canonical location
export { supabaseAdmin } from "../src/lib/supabaseAdmin.js";
