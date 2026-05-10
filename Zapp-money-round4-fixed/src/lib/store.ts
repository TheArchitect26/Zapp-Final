import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

async function backendWrite(
  path: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { data: { session } } = await supabase.auth.getSession();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const data = (await response.json()) as Record<string, unknown>;
  if (!response.ok || data?.success === false) {
    throw new Error((data?.error as string) || "BACKEND_WRITE_FAILED");
  }
  return data;
}

export function useWallet() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: walletData } = useQuery({
    queryKey: ["wallet", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["transactions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["wallet", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["transactions", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["coin_wallet", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
  }, [queryClient, user?.id]);

  const purchaseMutation = useMutation({
    mutationFn: async (params: {
      type: "airtime" | "electricity" | "voucher";
      description: string;
      amount: number;
      meta?: Record<string, string>;
    }) =>
      backendWrite("/api/v1/transactions", {
        fromAccountId: user?.id,
        toAccountId: `merchant:${params.type}`,
        amount: params.amount,
        currency: "ZAR",
        type: "purchase",
        meta: { description: params.description, ...(params.meta || {}) },
      }),
    onSuccess: invalidate,
  });

  const topUpMutation = useMutation({
    mutationFn: async (amount: number) => {
      const session = (await supabase.auth.getSession()).data.session;
      const response = await fetch(`${API_BASE}/api/v1/topup/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ amount }),
      });
      const data = await response.json() as Record<string, unknown>;
      if (!response.ok || !data.success) throw new Error((data.error as string) || "TOPUP_FAILED");
      window.location.href = data.checkoutUrl as string;
    },
    onSuccess: invalidate,
  });

  // P2P transfers go through the backend which runs the fraud pipeline,
  // ownership check, and transfer_funds RPC with p_sender_id set server-side.
  const transferMutation = useMutation({
    mutationFn: async (params: {
      recipientUsername: string;
      amount: number;
      message?: string;
    }) =>
      backendWrite("/api/v1/transfer/send", {
        senderId: user?.id,
        recipientUsername: params.recipientUsername,
        amount: params.amount,
        message: params.message || "",
      }),
    onSuccess: invalidate,
  });

  return {
    balance: (walletData?.balance as number) ?? 0,
    transactions,
    addTransaction: purchaseMutation.mutateAsync,
    topUp: topUpMutation.mutateAsync,
    transfer: transferMutation.mutateAsync,
    purchaseLoading: purchaseMutation.isPending,
    topUpLoading: topUpMutation.isPending,
    transferLoading: transferMutation.isPending,
  };
}

export function useProfile() {
  const { user } = useAuth();
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
  return profile;
}

export function useCoinWallet() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: coinWallet } = useQuery({
    queryKey: ["coin_wallet", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coin_wallets")
        .select("*")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["coin_wallet", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["wallet", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["transactions", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
  }, [queryClient, user?.id]);

  const convertMutation = useMutation({
    mutationFn: async (coins: number) =>
      backendWrite("/api/v1/transactions", {
        fromAccountId: `coins:${user?.id}`,
        toAccountId: user?.id,
        amount: coins,
        currency: "ZAR",
        type: "coin_conversion",
      }),
    onSuccess: invalidate,
  });

  return {
    coinBalance: (coinWallet?.balance as number) ?? 0,
    convertCoins: convertMutation.mutateAsync,
    convertLoading: convertMutation.isPending,
  };
}

export function useSurveys() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: surveys = [] } = useQuery({
    queryKey: ["surveys"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("surveys")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: completions = [] } = useQuery({
    queryKey: ["survey_completions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("survey_completions")
        .select("*")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const completeMutation = useMutation({
    mutationFn: async (surveyId: string) =>
      backendWrite("/api/v1/transactions", {
        fromAccountId: "system:rewards",
        toAccountId: user?.id,
        amount: 1,
        currency: "ZAR",
        type: "survey_reward",
        surveyId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["surveys"] });
      queryClient.invalidateQueries({ queryKey: ["survey_completions", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["coin_wallet", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["transactions", user?.id] });
    },
  });

  const completedIds = new Set(completions.map((c) => c.survey_id));

  return {
    surveys,
    completions,
    completedIds,
    completeSurvey: completeMutation.mutateAsync,
    completeLoading: completeMutation.isPending,
  };
}
