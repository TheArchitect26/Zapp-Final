import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";

export function useRealtimeWallet() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`wallet-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["wallet", user.id] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "coin_wallets", filter: `user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["coin_wallet", user.id] });
          queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "transactions", filter: `user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["transactions", user.id] });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);
}
