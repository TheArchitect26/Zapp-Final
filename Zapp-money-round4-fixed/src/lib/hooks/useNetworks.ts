import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useNetworks() {
  return useQuery({
    queryKey: ["networks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("networks")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}
