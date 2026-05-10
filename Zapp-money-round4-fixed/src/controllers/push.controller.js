import { supabaseAdmin } from "../lib/supabaseAdmin.js";

export async function subscribe(req, res, next) {
  try {
    const { subscription } = req.body;
    if (!subscription?.endpoint) return res.status(400).json({ success: false, error: "INVALID_SUBSCRIPTION" });
    await supabaseAdmin.from("push_subscriptions")
      .insert({ user_id: req.user.id, subscription })
      .select();
    // Duplicate endpoint for same user is silently ignored by the unique constraint
    return res.json({ success: true });
  } catch (err) { return next(err); }
}

export async function unsubscribe(req, res, next) {
  try {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ success: false, error: "MISSING_ENDPOINT" });
    await supabaseAdmin.from("push_subscriptions")
      .delete()
      .eq("user_id", req.user.id)
      .filter("subscription->>endpoint", "eq", endpoint);
    return res.json({ success: true });
  } catch (err) { return next(err); }
}
