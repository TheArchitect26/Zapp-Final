import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/store";
import type { CoinRate } from "@/lib/coins";

export function useUserCurrency(): string {
  const profile = useProfile();
  return (profile as any)?.currency_code || "ZAR";
}

export function useCoinRate() {
  const currencyCode = useUserCurrency();

  const { data: rate, isLoading } = useQuery<CoinRate>({
    queryKey: ["coin_rate", currencyCode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coin_exchange_rates")
        .select("zc_per_unit, symbol, display_decimals, currency_code")
        .eq("currency_code", currencyCode)
        .eq("active", true)
        .single();
      if (error) throw error;
      return {
        zc_per_unit:      Number(data.zc_per_unit),
        symbol:           data.symbol,
        display_decimals: data.display_decimals,
        currency_code:    data.currency_code,
      };
    },
    staleTime: 60_000,
  });

  // Fallback rate (ZAR 100:1) so callers never need to null-check
  const fallback: CoinRate = { zc_per_unit: 100, symbol: "R", display_decimals: 2, currency_code: "ZAR" };
  return { rate: rate ?? fallback, isLoading };
}
