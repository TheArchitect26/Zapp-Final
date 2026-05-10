import { supabase } from "@/integrations/supabase/client";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

/**
 * Fetch wrapper that automatically injects the current Supabase session token.
 * Throws on non-2xx responses with the JSON error body if available.
 */
export async function authedFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    throw new Error("SESSION_EXPIRED");
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body != null ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const body = await res.clone().json();
      message = body?.error ?? message;
    } catch { /* non-JSON body */ }
    throw new Error(message);
  }

  return res;
}
