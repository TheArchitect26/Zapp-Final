import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useBadges() {
  return useQuery({
    queryKey: ["badges"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("badges")
        .select("*")
        .eq("status", "active")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });
}

export function useUserBadges() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["user_badges", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_badges")
        .select("*, badge:badges(*)")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useEvaluateBadges() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("evaluate_user_badges");
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user_badges", user?.id] });
      qc.invalidateQueries({ queryKey: ["wallet", user?.id] });
      qc.invalidateQueries({ queryKey: ["transactions", user?.id] });
      qc.invalidateQueries({ queryKey: ["feed_events"] });
    },
  });
}
