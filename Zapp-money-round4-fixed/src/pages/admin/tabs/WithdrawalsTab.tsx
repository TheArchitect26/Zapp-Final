/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { Check, X, Clock, Loader2, AlertCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ZappButton from "@/components/ZappButton";
import { toast } from "sonner";

function useAdminWithdrawals() {
  const queryClient = useQueryClient();

  const { data: withdrawals = [], isLoading } = useQuery({
    queryKey: ["admin_withdrawals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawal_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, admin_notes }: { id: string; status: string; admin_notes?: string }) => {
      const { error } = await supabase
        .from("withdrawal_requests")
        .update({ status, admin_notes: admin_notes || null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_withdrawals"] });
      toast.success("Withdrawal updated");
    },
  });

  return { withdrawals, isLoading, updateStatus: updateStatus.mutateAsync };
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400",
  processing: "bg-secondary/20 text-secondary",
  paid: "bg-accent/20 text-accent",
  failed: "bg-destructive/20 text-destructive",
  reversed: "bg-muted/20 text-muted-foreground",
};

export default function WithdrawalsTab() {
  const { withdrawals, isLoading, updateStatus } = useAdminWithdrawals();
  const [filter, setFilter] = useState<string>("all");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const filtered = filter === "all" ? withdrawals : withdrawals.filter((w: any) => w.status === filter);

  const handleAction = async (id: string, status: string) => {
    setProcessingId(id);
    try {
      await updateStatus({ id, status });
    } catch (err) {
      toast.error((err as Error).message);
    }
    setProcessingId(null);
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {["all", "pending", "processing", "paid", "failed"].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 h-8 rounded-lg text-xs font-semibold whitespace-nowrap transition-all capitalize ${
              filter === s ? "bg-primary text-primary-foreground" : "bg-foreground/5 text-muted-foreground"
            }`}>{s}</button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">No withdrawals found</p>
      )}

      {filtered.map((w: any) => (
        <div key={w.id} className="glass-card rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="font-bold text-sm">R{w.amount?.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">
                Net: R{w.net_amount?.toFixed(2)} · Fee: R{w.fee_amount?.toFixed(2)}
              </p>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize ${statusColors[w.status] || ""}`}>
              {w.status}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            User: {w.user_id?.slice(0, 8)}… · {new Date(w.created_at).toLocaleString()}
          </p>
          {w.admin_notes && (
            <p className="text-xs text-muted-foreground italic mb-2">Note: {w.admin_notes}</p>
          )}
          {w.status === "pending" && (
            <div className="flex gap-2">
              <button onClick={() => handleAction(w.id, "processing")}
                disabled={processingId === w.id}
                className="flex items-center gap-1 text-xs font-semibold text-secondary bg-secondary/10 px-3 py-1.5 rounded-lg">
                <Clock size={12} /> Process
              </button>
              <button onClick={() => handleAction(w.id, "paid")}
                disabled={processingId === w.id}
                className="flex items-center gap-1 text-xs font-semibold text-accent bg-accent/10 px-3 py-1.5 rounded-lg">
                <Check size={12} /> Approve
              </button>
              <button onClick={() => handleAction(w.id, "failed")}
                disabled={processingId === w.id}
                className="flex items-center gap-1 text-xs font-semibold text-destructive bg-destructive/10 px-3 py-1.5 rounded-lg">
                <X size={12} /> Reject
              </button>
            </div>
          )}
          {w.status === "processing" && (
            <div className="flex gap-2">
              <button onClick={() => handleAction(w.id, "paid")}
                disabled={processingId === w.id}
                className="flex items-center gap-1 text-xs font-semibold text-accent bg-accent/10 px-3 py-1.5 rounded-lg">
                <Check size={12} /> Mark Paid
              </button>
              <button onClick={() => handleAction(w.id, "failed")}
                disabled={processingId === w.id}
                className="flex items-center gap-1 text-xs font-semibold text-destructive bg-destructive/10 px-3 py-1.5 rounded-lg">
                <X size={12} /> Mark Failed
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
