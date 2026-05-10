/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { ToggleLeft, ToggleRight, Plus, Settings } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ZappButton from "@/components/ZappButton";
import { toast } from "sonner";

function useAdminFees() {
  const queryClient = useQueryClient();

  const { data: fees = [] } = useQuery({
    queryKey: ["admin_fees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fee_config")
        .select("*")
        .order("fee_type");
      if (error) throw error;
      return data;
    },
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("fee_config")
        .update({ status: status === "active" ? "inactive" : "active" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin_fees"] }),
  });

  const updateFee = useMutation({
    mutationFn: async (params: { id: string; percentage_fee: number; fixed_fee: number; min_fee: number; max_fee: number }) => {
      const { id, ...updates } = params;
      const { error } = await supabase.from("fee_config").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_fees"] });
      toast.success("Fee updated");
    },
  });

  const addFee = useMutation({
    mutationFn: async (fee: { fee_type: string; product_type?: string; percentage_fee: number; fixed_fee: number; min_fee: number; max_fee: number; description?: string }) => {
      const { error } = await supabase.from("fee_config").insert(fee);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_fees"] });
      toast.success("Fee added");
    },
  });

  return { fees, toggleStatus: toggleStatus.mutate, updateFee: updateFee.mutateAsync, addFee: addFee.mutateAsync };
}

const inputClass = "w-full h-10 bg-foreground/5 rounded-lg px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none";

export default function FeesTab() {
  const { fees, toggleStatus, addFee } = useAdminFees();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    fee_type: "withdrawal",
    product_type: "",
    percentage_fee: 0,
    fixed_fee: 0,
    min_fee: 0,
    max_fee: 0,
    description: "",
  });

  const handleAdd = async () => {
    if (!form.fee_type) return;
    try {
      await addFee({
        ...form,
        percentage_fee: Number(form.percentage_fee),
        fixed_fee: Number(form.fixed_fee),
        min_fee: Number(form.min_fee),
        max_fee: Number(form.max_fee),
        product_type: form.product_type || undefined,
      });
      setForm({ fee_type: "withdrawal", product_type: "", percentage_fee: 0, fixed_fee: 0, min_fee: 0, max_fee: 0, description: "" });
      setShowAdd(false);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="space-y-3">
      <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-2 text-sm font-semibold text-primary">
        <Plus size={16} /> Add Fee Rule
      </button>

      {showAdd && (
        <div className="glass-card rounded-2xl p-4 space-y-3">
          <select value={form.fee_type} onChange={(e) => setForm({ ...form, fee_type: e.target.value })} className={inputClass}>
            <option value="withdrawal">Withdrawal</option>
            <option value="transfer">Transfer</option>
            <option value="purchase">Purchase</option>
            <option value="electricity">Electricity</option>
            <option value="voucher">Voucher</option>
          </select>
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" className={inputClass} />
          <div className="grid grid-cols-2 gap-3">
            <input type="number" value={form.percentage_fee} onChange={(e) => setForm({ ...form, percentage_fee: Number(e.target.value) })} placeholder="% Fee" className={inputClass} step="0.1" />
            <input type="number" value={form.fixed_fee} onChange={(e) => setForm({ ...form, fixed_fee: Number(e.target.value) })} placeholder="Fixed Fee" className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input type="number" value={form.min_fee} onChange={(e) => setForm({ ...form, min_fee: Number(e.target.value) })} placeholder="Min Fee" className={inputClass} />
            <input type="number" value={form.max_fee} onChange={(e) => setForm({ ...form, max_fee: Number(e.target.value) })} placeholder="Max Fee" className={inputClass} />
          </div>
          <ZappButton onClick={handleAdd}>Add Fee Rule</ZappButton>
        </div>
      )}

      {fees.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">No fee rules configured</p>
      )}

      {fees.map((f: any) => (
        <div key={f.id} className="glass-card rounded-2xl p-4 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sm capitalize">{f.fee_type}</p>
            <p className="text-xs text-muted-foreground">{f.description || "No description"}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              <span>{f.percentage_fee}%</span>
              {f.fixed_fee > 0 && <span>+ R{f.fixed_fee}</span>}
              <span>·</span>
              <span>Min R{f.min_fee}</span>
              {f.max_fee > 0 && <span>· Max R{f.max_fee}</span>}
            </div>
          </div>
          <button onClick={() => toggleStatus({ id: f.id, status: f.status })}>
            {f.status === "active" ? (
              <ToggleRight size={28} className="text-accent" />
            ) : (
              <ToggleLeft size={28} className="text-muted-foreground" />
            )}
          </button>
        </div>
      ))}
    </div>
  );
}
