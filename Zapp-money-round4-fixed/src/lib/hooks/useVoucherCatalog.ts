import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useVoucherBrands() {
  return useQuery({
    queryKey: ["voucher_brands"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("voucher_brands")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useVoucherProducts(brandId: string | null) {
  return useQuery({
    queryKey: ["voucher_products", brandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("voucher_products")
        .select("*")
        .eq("brand_id", brandId!)
        .order("value");
      if (error) throw error;
      return data;
    },
    enabled: !!brandId,
    staleTime: 5 * 60 * 1000,
  });
}
