import crypto from "crypto";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

/**
 * Authenticates requests from partner systems via X-Partner-Key header.
 * Looks up the SHA-256 hash of the key in the partner_keys table.
 * Attaches req.partner = { id, name, scopes } on success.
 */
export async function requirePartnerAuth(req, res, next) {
  const key = req.headers["x-partner-key"];
  if (!key) {
    return res.status(401).json({ success: false, error: "MISSING_PARTNER_KEY" });
  }

  const keyHash = crypto.createHash("sha256").update(key).digest("hex");

  const { data: partner, error } = await supabaseAdmin
    .from("partner_keys")
    .select("id, partner_name, scopes, active")
    .eq("key_hash", keyHash)
    .single();

  if (error || !partner) {
    return res.status(403).json({ success: false, error: "INVALID_PARTNER_KEY" });
  }

  if (!partner.active) {
    return res.status(403).json({ success: false, error: "PARTNER_KEY_INACTIVE" });
  }

  req.partner = { id: partner.id, name: partner.partner_name, scopes: partner.scopes };
  next();
}
