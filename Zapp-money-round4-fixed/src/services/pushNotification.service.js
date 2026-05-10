import webpush from "web-push";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { logger } from "../lib/logger.js";

webpush.setVapidDetails(
  process.env.VAPID_EMAIL || "mailto:notifications@zappmoney.co.za",
  process.env.VAPID_PUBLIC_KEY || "",
  process.env.VAPID_PRIVATE_KEY || ""
);

export async function sendPush(userId, { title, body, icon = "/favicon.ico", url = "/" }) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;

  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions").select("id, subscription").eq("user_id", userId);

  if (!subs?.length) return;

  const payload = JSON.stringify({ title, body, icon, url });

  for (const row of subs) {
    try {
      await webpush.sendNotification(row.subscription, payload);
    } catch (err) {
      if (err.statusCode === 410) {
        await supabaseAdmin.from("push_subscriptions").delete().eq("id", row.id);
      } else {
        logger.error("push send failed", { userId, err: err.message });
      }
    }
  }
}
