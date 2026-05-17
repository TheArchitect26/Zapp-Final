import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { authedFetch } from "@/lib/api";

// ── Top-up (Collection) ───────────────────────────────────────────────────────

export function useMomoTopUp() {
  const [referenceId, setReferenceId] = useState<string | null>(null);

  const initiate = useMutation({
    mutationFn: async (params: { amount: number; phone: string; currency?: string }) => {
      const res = await authedFetch("/api/v1/momo/topup", {
        method: "POST",
        body: JSON.stringify({ ...params, currency: params.currency ?? "EUR" }),
      });
      const data = await res.json();
      setReferenceId(data.referenceId);
      return data as { referenceId: string; externalId: string };
    },
  });

  const status = useQuery({
    queryKey: ["momo-topup-status", referenceId],
    queryFn: async () => {
      const res = await authedFetch(`/api/v1/momo/topup/${referenceId}`);
      return res.json() as Promise<{ status: "PENDING" | "SUCCESSFUL" | "FAILED"; reason?: string }>;
    },
    enabled: !!referenceId,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return !s || s === "PENDING" ? 3000 : false;
    },
  });

  return { initiate, status, referenceId, reset: () => setReferenceId(null) };
}

// ── Payout (Disbursement / Transfer) ─────────────────────────────────────────

export function useMomoPayout() {
  const [referenceId, setReferenceId] = useState<string | null>(null);

  const initiate = useMutation({
    mutationFn: async (params: { amount: number; phone: string; currency?: string }) => {
      const res = await authedFetch("/api/v1/momo/transfer", {
        method: "POST",
        body: JSON.stringify({ ...params, currency: params.currency ?? "EUR" }),
      });
      const data = await res.json();
      setReferenceId(data.referenceId);
      return data as { referenceId: string };
    },
  });

  const status = useQuery({
    queryKey: ["momo-payout-status", referenceId],
    queryFn: async () => {
      const res = await authedFetch(`/api/v1/momo/transfer/${referenceId}`);
      return res.json() as Promise<{ status: "PENDING" | "SUCCESSFUL" | "FAILED"; reason?: string }>;
    },
    enabled: !!referenceId,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return !s || s === "PENDING" ? 3000 : false;
    },
  });

  return { initiate, status, referenceId, reset: () => setReferenceId(null) };
}

// ── Validate account holder ───────────────────────────────────────────────────

export function useMomoValidate(phone: string) {
  return useQuery({
    queryKey: ["momo-validate", phone],
    queryFn: async () => {
      const res = await authedFetch(`/api/v1/momo/validate/${phone}`);
      return res.json() as Promise<{ active: boolean }>;
    },
    enabled: phone.length >= 9,
    staleTime: 30_000,
  });
}

// ── Disbursement balance ──────────────────────────────────────────────────────

export function useMomoBalance() {
  return useQuery({
    queryKey: ["momo-balance"],
    queryFn: async () => {
      const res = await authedFetch("/api/v1/momo/balance");
      return res.json() as Promise<{ availableBalance: string; currency: string }>;
    },
  });
}
