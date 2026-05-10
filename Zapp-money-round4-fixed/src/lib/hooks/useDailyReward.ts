import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useDailyReward() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: streak } = useQuery({
    queryKey: ["user_streak", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_streaks")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const canClaim = !streak?.last_claim_date || streak.last_claim_date !== new Date().toISOString().split("T")[0];

  const claimMutation = useMutation({
    mutationFn: async () => {
      const { authedFetch } = await import("@/lib/api");
      const res = await authedFetch("/api/v1/earn/daily", { method: "POST" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_streak", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["wallet", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["transactions", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["feed_events"] });
    },
  });

  const BASE_REWARDS = [0.50, 0.75, 1.00, 1.50, 2.00, 3.00, 5.00];

  return {
    streak,
    canClaim,
    claimDaily: claimMutation.mutateAsync,
    claimLoading: claimMutation.isPending,
    baseRewards: BASE_REWARDS,
  };
}
