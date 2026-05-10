import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const API = import.meta.env.VITE_API_BASE_URL || "";
const VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

function urlBase64ToUint8Array(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function usePushNotifications() {
  const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supported) return;
    navigator.serviceWorker.ready.then(async (reg) => {
      const existing = await reg.pushManager.getSubscription();
      setSubscribed(!!existing);
    });
  }, [supported]);

  async function authHeader() {
    const session = (await supabase.auth.getSession()).data.session;
    return { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` };
  }

  async function subscribe() {
    if (!supported || !VAPID_KEY) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_KEY),
      });
      await fetch(`${API}/api/v1/push/subscribe`, {
        method: "POST",
        headers: await authHeader(),
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      setSubscribed(true);
    } finally { setLoading(false); }
  }

  async function unsubscribe() {
    if (!supported) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch(`${API}/api/v1/push/unsubscribe`, {
          method: "POST",
          headers: await authHeader(),
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } finally { setLoading(false); }
  }

  return { supported, subscribed, loading, subscribe, unsubscribe };
}
