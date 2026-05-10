import { supabaseAdmin } from "../lib/supabaseAdmin.js";

/**
 * Verifies the Supabase JWT from the Authorization header.
 * Attaches `req.user` on success.
 */
export async function requireAuth(req, res, next) {
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, error: "MISSING_AUTH_TOKEN" });
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data?.user) {
    return res.status(401).json({ success: false, error: "INVALID_AUTH_TOKEN" });
  }

  req.user = data.user;
  next();
}

/**
 * Verifies the caller is an admin via has_role RPC.
 * Must be used after requireAuth.
 */
export async function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: "NOT_AUTHENTICATED" });
  }

  const { data: isAdmin, error } = await supabaseAdmin.rpc("has_role", {
    _user_id: req.user.id,
    _role: "admin",
  });

  if (error || !isAdmin) {
    return res.status(403).json({ success: false, error: "ADMIN_REQUIRED" });
  }

  next();
}
