import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useEarnOpportunities() {
  const { data: opportunities = [], isLoading } = useQuery({
    queryKey: ["earn_opportunities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("earn_opportunities")
        .select("*")
        .eq("status", "active")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const categories = [...new Set(opportunities.map((o) => o.category))];

  return { opportunities, categories, isLoading };
}

export function useEarnCompletions() {
  const { user } = useAuth();

  const { data: completions = [], isLoading } = useQuery({
    queryKey: ["earn_completions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("earn_completions")
        .select("*")
        .eq("user_id", user!.id)
        .order("completed_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const completedIds = new Set(completions.map((c) => c.opportunity_id));

  return { completions, completedIds, isLoading };
}

export function useCompleteEarn() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (opportunityId: string) => {
      const { authedFetch } = await import("@/lib/api");
      const res = await authedFetch("/api/v1/earn/complete", {
        method: "POST",
        body: JSON.stringify({ opportunity_id: opportunityId }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["earn_opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["earn_completions", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["coin_wallet", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["transactions", user?.id] });
    },
  });
}
