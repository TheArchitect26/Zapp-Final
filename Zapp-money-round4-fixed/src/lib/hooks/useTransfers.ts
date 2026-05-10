import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useCurrencies() {
  const { data: currencies = [], isLoading } = useQuery({
    queryKey: ["currencies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("currencies")
        .select("*")
        .eq("status", "active")
        .order("code");
      if (error) throw error;
      return data;
    },
  });
  return { currencies, isLoading };
}

export function useCorridors() {
  const { data: corridors = [], isLoading } = useQuery({
    queryKey: ["transfer_corridors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transfer_corridors")
        .select("*, source:currencies!transfer_corridors_source_currency_id_fkey(*), destination:currencies!transfer_corridors_destination_currency_id_fkey(*)")
        .eq("status", "active");
      if (error) throw error;
      return data;
    },
  });
  return { corridors, isLoading };
}

export function useInternationalTransfers() {
  const { user } = useAuth();

  const { data: transfers = [], isLoading } = useQuery({
    queryKey: ["international_transfers", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("international_transfers")
        .select("*")
        .eq("sender_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  return { transfers, isLoading };
}

export function useSendInternational() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      recipient: string;
      sourceAmount: number;
      destinationCurrency: string;
      corridorId: string;
    }) => {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ""}/api/v1/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromAccountId: user?.id,
          toAccountId: params.recipient,
          amount: params.sourceAmount,
          currency: params.destinationCurrency,
          type: "international_transfer",
          corridorId: params.corridorId,
        }),
      });
      const data = await response.json();
      if (!response.ok || data?.success === false) throw new Error(data?.error || "TRANSFER_FAILED");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["transactions", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["international_transfers", user?.id] });
    },
  });
}
