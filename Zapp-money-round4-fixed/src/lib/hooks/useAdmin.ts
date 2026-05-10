import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function useIsAdmin() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["is_admin", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: user!.id,
        _role: "admin",
      });
      if (error) throw error;
      return data as boolean;
    },
    enabled: !!user,
  });
}

export function useAdminTransactions(page = 0, pageSize = 50) {
  return useQuery({
    queryKey: ["admin_transactions", page, pageSize],
    queryFn: async () => {
      const from = page * pageSize;
      const to   = from + pageSize - 1;
      const { data, error, count } = await supabase
        .from("transactions")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      return { data: data ?? [], total: count ?? 0, page, pageSize };
    },
  });
}

export function useAdminProfiles(page = 0, pageSize = 50) {
  return useQuery({
    queryKey: ["admin_profiles", page, pageSize],
    queryFn: async () => {
      const from = page * pageSize;
      const to   = from + pageSize - 1;
      const { data, error, count } = await supabase
        .from("profiles")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      return { data: data ?? [], total: count ?? 0, page, pageSize };
    },
  });
}

export function useAdminNetworks() {
  const queryClient = useQueryClient();

  const { data: networks = [] } = useQuery({
    queryKey: ["admin_networks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("networks")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("networks")
        .update({ status: status === "active" ? "inactive" : "active" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin_networks"] }),
  });

  return { networks, toggleStatus: toggleStatus.mutate };
}

export function useAdminVoucherBrands() {
  const queryClient = useQueryClient();

  const { data: brands = [] } = useQuery({
    queryKey: ["admin_voucher_brands"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("voucher_brands")
        .select("*, voucher_products(*)")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("voucher_brands")
        .update({ status: status === "active" ? "inactive" : "active" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin_voucher_brands"] }),
  });

  const addBrand = useMutation({
    mutationFn: async (brand: { name: string; category: string; color_class: string }) => {
      const { error } = await supabase.from("voucher_brands").insert(brand);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin_voucher_brands"] }),
  });

  const addProduct = useMutation({
    mutationFn: async (product: { brand_id: string; value: number; price: number }) => {
      const { error } = await supabase.from("voucher_products").insert(product);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin_voucher_brands"] }),
  });

  return { brands, toggleStatus: toggleStatus.mutate, addBrand: addBrand.mutateAsync, addProduct: addProduct.mutateAsync };
}

export function useAdminSurveys() {
  const queryClient = useQueryClient();

  const { data: surveys = [] } = useQuery({
    queryKey: ["admin_surveys"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("surveys")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("surveys")
        .update({ active: !active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin_surveys"] }),
  });

  return { surveys, toggleActive: toggleActive.mutate };
}

export function useAdminEarnOpportunities() {
  const queryClient = useQueryClient();

  const { data: opportunities = [] } = useQuery({
    queryKey: ["admin_earn_opportunities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("earn_opportunities")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("earn_opportunities")
        .update({ status: status === "active" ? "inactive" : "active" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin_earn_opportunities"] }),
  });

  const addOpportunity = useMutation({
    mutationFn: async (opp: {
      title: string;
      category: string;
      coin_reward: number;
      provider: string;
      estimated_minutes: number;
      description?: string;
      availability_type?: string;
    }) => {
      const { error } = await supabase.from("earn_opportunities").insert(opp);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin_earn_opportunities"] }),
  });

  return {
    opportunities,
    toggleStatus: toggleStatus.mutate,
    addOpportunity: addOpportunity.mutateAsync,
  };
}

export function useAdminCurrencies() {
  const queryClient = useQueryClient();

  const { data: currencies = [] } = useQuery({
    queryKey: ["admin_currencies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("currencies")
        .select("*")
        .order("code");
      if (error) throw error;
      return data;
    },
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("currencies")
        .update({ status: status === "active" ? "inactive" : "active" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin_currencies"] }),
  });

  const addCurrency = useMutation({
    mutationFn: async (c: { code: string; name: string; symbol: string; country?: string; zc_rate: number }) => {
      const { error } = await supabase.from("currencies").insert(c);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin_currencies"] }),
  });

  const updateRate = useMutation({
    mutationFn: async ({ id, zc_rate }: { id: string; zc_rate: number }) => {
      const { error } = await supabase
        .from("currencies")
        .update({ zc_rate })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin_currencies"] }),
  });

  return {
    currencies,
    toggleStatus: toggleStatus.mutate,
    addCurrency: addCurrency.mutateAsync,
    updateRate: updateRate.mutate,
  };
}

export function useAdminCorridors() {
  const queryClient = useQueryClient();

  const { data: corridors = [] } = useQuery({
    queryKey: ["admin_corridors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transfer_corridors")
        .select("*, source:currencies!transfer_corridors_source_currency_id_fkey(*), destination:currencies!transfer_corridors_destination_currency_id_fkey(*)")
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("transfer_corridors")
        .update({ status: status === "active" ? "inactive" : "active" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin_corridors"] }),
  });

  const addCorridor = useMutation({
    mutationFn: async (c: {
      source_currency_id: string;
      destination_currency_id: string;
      fee_percentage: number;
      flat_fee: number;
      min_amount: number;
      max_amount: number;
    }) => {
      const { error } = await supabase.from("transfer_corridors").insert(c);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin_corridors"] }),
  });

  return {
    corridors,
    toggleStatus: toggleStatus.mutate,
    addCorridor: addCorridor.mutateAsync,
  };
}
