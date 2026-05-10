import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDownToLine, Check, AlertCircle, Clock, Loader2, Banknote, Plus, ShieldAlert } from "lucide-react";
import { useWallet, useProfile } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import BottomSheet from "@/components/BottomSheet";
import ZappButton from "@/components/ZappButton";
import { toast } from "sonner";

function useWithdrawals() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["withdrawals", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawal_requests")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

function usePayoutMethods() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["payout_methods", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payout_methods")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

function useFeeConfig() {
  return useQuery({
    queryKey: ["fee_config", "withdrawal"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fee_config")
        .select("*")
        .eq("fee_type", "withdrawal")
        .eq("status", "active")
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data || { percentage_fee: 4, min_fee: 2, max_fee: 15 };
    },
  });
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400",
  processing: "bg-secondary/20 text-secondary",
  paid: "bg-accent/20 text-accent",
  failed: "bg-destructive/20 text-destructive",
  reversed: "bg-muted/20 text-muted-foreground",
};

export default function Withdraw() {
  const wallet = useWallet();
  const profile = useProfile();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: withdrawals = [], isLoading: withdrawalsLoading } = useWithdrawals();
  const { data: payoutMethods = [] } = usePayoutMethods();
  const { data: feeConfig } = useFeeConfig();
  const kycStatus = profile?.kyc_status || "unverified";
  const [sheetOpen, setSheetOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [addMethodOpen, setAddMethodOpen] = useState(false);
  const [methodLabel, setMethodLabel] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");

  const [pollingId, setPollingId] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);

  // Poll withdrawal status after submission
  useEffect(() => {
    if (!pollingId) return;
    const interval = setInterval(async () => {
      const { data } = await supabase.from("withdrawal_requests").select("status").eq("id", pollingId).single();
      if (data?.status) {
        setLiveStatus(data.status);
        if (["paid", "failed", "reversed"].includes(data.status)) clearInterval(interval);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [pollingId]);

  const withdrawMutation = useMutation({
    mutationFn: async (params: { amount: number; payoutMethodId?: string }) => {
      const API = import.meta.env.VITE_API_BASE_URL || "";
      const session = (await supabase.auth.getSession()).data.session;
      const response = await fetch(`${API}/api/v1/withdraw/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ amount: params.amount, payoutMethodId: params.payoutMethodId }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Withdrawal failed");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      if (data.withdrawal?.id) setPollingId(data.withdrawal.id);
    },
  });

  const addMethodMutation = useMutation({
    mutationFn: async () => {
      // Full account numbers are not persisted.
      // Integrate Supabase Vault or a payment provider tokenization API before storing full details.
      const { error } = await supabase.from("payout_methods").insert({
        user_id: user!.id,
        type: "bank",
        label: methodLabel,
        details: { bank_name: bankName, account_last4: accountNumber.slice(-4) },
        is_default: payoutMethods.length === 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payout_methods"] });
      setAddMethodOpen(false);
      setMethodLabel("");
      setBankName("");
      setAccountNumber("");
      toast.success("Payout method added");
    },
  });

  const calcFee = (amt: number) => {
    if (!feeConfig || amt <= 0) return { fee: 0, net: 0 };
    let fee = amt * (feeConfig.percentage_fee / 100);
    if (fee < feeConfig.min_fee) fee = feeConfig.min_fee;
    if (feeConfig.max_fee > 0 && fee > feeConfig.max_fee) fee = feeConfig.max_fee;
    return { fee: Math.round(fee * 100) / 100, net: Math.round((amt - fee) * 100) / 100 };
  };

  const parsedAmount = parseFloat(amount) || 0;
  const { fee, net } = calcFee(parsedAmount);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const defaultMethod = payoutMethods.find((m: any) => m.is_default) || payoutMethods[0];

  const handleWithdraw = async () => {
    if (parsedAmount < 20) { toast.error("Minimum withdrawal is R20"); return; }
    if (parsedAmount > wallet.balance) { toast.error("Insufficient balance"); return; }
    try {
      await withdrawMutation.mutateAsync({
        amount: parsedAmount,
        payoutMethodId: defaultMethod?.id,
      });
      toast.success("Withdrawal submitted!");
      setSheetOpen(false);
      setAmount("");
    } catch (err) {
      toast.error((err as Error).message || "Withdrawal failed");
    }
  };

  return (
    <div className="min-h-screen pb-24 px-5 pt-12">
      <h1 className="text-xl font-bold tracking-tight mb-6">withdraw</h1>

      {/* KYC Gate */}
      {kycStatus !== "verified" && (
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="glass-card rounded-2xl p-6 mb-6 border border-destructive/20">
          <div className="flex items-start gap-3">
            <ShieldAlert size={24} className="text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm mb-1">KYC Verification Required</p>
              <p className="text-xs text-muted-foreground mb-3">
                {kycStatus === "pending"
                  ? "Your verification is being reviewed. You'll be able to withdraw once approved."
                  : "You must verify your identity before you can make withdrawals. This helps us keep your account safe."}
              </p>
              {kycStatus !== "pending" && (
                <ZappButton onClick={() => navigate("/profile")}>
                  Verify Identity
                </ZappButton>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Live withdrawal status */}
      {liveStatus && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className={`glass-card rounded-2xl p-4 mb-4 text-sm font-semibold flex items-center gap-2 ${
            liveStatus === "paid" ? "text-accent" : liveStatus === "failed" || liveStatus === "reversed" ? "text-destructive" : "text-yellow-400"
          }`}>
          {liveStatus === "paid" ? <Check size={16} /> : liveStatus === "failed" ? <AlertCircle size={16} /> : <Clock size={16} />}
          {liveStatus === "paid" ? "Withdrawal paid — usually 1–2 business days to arrive" :
           liveStatus === "processing" ? "Processing your withdrawal…" :
           liveStatus === "failed" || liveStatus === "reversed" ? "Withdrawal failed — funds returned to your wallet" :
           `Status: ${liveStatus}`}
        </motion.div>
      )}

      {/* Balance card */}
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="glass-card rounded-2xl p-6 mb-6">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">available balance</p>
        <p className="text-3xl font-extrabold tabular-nums tracking-tight mb-4">
          R {wallet.balance.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
        </p>
        <ZappButton onClick={() => setSheetOpen(true)} disabled={wallet.balance < 20 || kycStatus !== "verified"}>
          <ArrowDownToLine size={16} /> Withdraw Funds
        </ZappButton>
        {kycStatus === "verified" && wallet.balance < 20 && wallet.balance > 0 && (
          <p className="text-xs text-muted-foreground mt-2">Minimum withdrawal: R20</p>
        )}
      </motion.div>

      {/* Fee info */}
      {feeConfig && (
        <div className="glass-card rounded-2xl p-4 mb-6 flex items-start gap-3">
          <AlertCircle size={16} className="text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground space-y-0.5">
            <p>Withdrawal fee: {feeConfig.percentage_fee}%</p>
            <p>Min fee: R{feeConfig.min_fee} · Max fee: R{feeConfig.max_fee}</p>
            <p>Minimum withdrawal: R20</p>
          </div>
        </div>
      )}

      {/* Payout methods */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">payout methods</h2>
        <button onClick={() => setAddMethodOpen(true)} className="text-xs text-primary font-semibold flex items-center gap-1">
          <Plus size={12} /> Add
        </button>
      </div>
      {payoutMethods.length === 0 ? (
        <div className="glass-card rounded-2xl p-6 text-center mb-6">
          <Banknote size={28} className="text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No payout methods added</p>
          <p className="text-xs text-muted-foreground/60 mt-0.5">Add a bank account to withdraw funds</p>
        </div>
      ) : (
        <div className="space-y-2 mb-6">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {payoutMethods.map((m: any) => (
            <div key={m.id} className="glass-card rounded-2xl p-4 flex items-center gap-3">
              <Banknote size={18} className="text-primary" />
              <div className="flex-1">
                <p className="text-sm font-semibold">{m.label}</p>
                <p className="text-xs text-muted-foreground">{m.details?.bank_name} · ····{m.details?.account_last4 ?? m.details?.account_number?.slice(-4)}</p>
              </div>
              {m.is_default && <span className="text-[10px] font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded-full">Default</span>}
            </div>
          ))}
        </div>
      )}

      {/* Withdrawal History */}
      <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">withdrawal history</h2>
      {withdrawalsLoading ? (
        <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>
      ) : withdrawals.length === 0 ? (
        <div className="glass-card rounded-2xl p-6 text-center">
          <Clock size={28} className="text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No withdrawals yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {withdrawals.map((w: any) => (
            <div key={w.id} className="glass-card rounded-2xl p-4 flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                w.status === "paid" ? "bg-accent/20" : w.status === "failed" ? "bg-destructive/20" : "bg-yellow-500/20"
              }`}>
                {w.status === "paid" ? <Check size={14} className="text-accent" /> :
                 w.status === "failed" ? <AlertCircle size={14} className="text-destructive" /> :
                 <Clock size={14} className="text-yellow-400" />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">R{w.net_amount?.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Fee: R{w.fee_amount?.toFixed(2)} · {new Date(w.created_at).toLocaleDateString()}</p>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize ${statusColors[w.status] || ""}`}>
                {w.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Withdraw Sheet */}
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Withdraw Funds">
        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-3 gap-2">
            {[50, 100, 200].map((amt) => (
              <button key={amt} onClick={() => setAmount(String(amt))}
                disabled={amt > wallet.balance}
                className={`h-12 rounded-lg font-bold text-sm transition-all ${
                  amount === String(amt) ? "bg-primary text-primary-foreground" : "bg-foreground/5 text-foreground"
                } ${amt > wallet.balance ? "opacity-30" : ""}`}>R{amt}</button>
            ))}
          </div>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount (min R20)"
            className="w-full h-14 bg-foreground/5 rounded-lg px-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium" />
          {parsedAmount >= 20 && (
            <div className="bg-foreground/5 rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span>R{parsedAmount.toFixed(2)}</span></div>
              <div className="flex justify-between text-destructive"><span>Fee ({feeConfig?.percentage_fee || 4}%)</span><span>-R{fee.toFixed(2)}</span></div>
              <div className="flex justify-between font-bold border-t border-foreground/10 pt-1 mt-1"><span>You receive</span><span>R{net.toFixed(2)}</span></div>
            </div>
          )}
          {defaultMethod && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Banknote size={12} /> Payout to: {defaultMethod.label}
            </div>
          )}
          <ZappButton onClick={handleWithdraw} loading={withdrawMutation.isPending}
            disabled={parsedAmount < 20 || parsedAmount > wallet.balance}>
            Withdraw R{net > 0 ? net.toFixed(2) : "0"}
          </ZappButton>
        </div>
      </BottomSheet>

      {/* Add Payout Method Sheet */}
      <BottomSheet open={addMethodOpen} onClose={() => setAddMethodOpen(false)} title="Add Payout Method">
        <div className="space-y-4 mt-4">
          <input type="text" value={methodLabel} onChange={(e) => setMethodLabel(e.target.value)}
            placeholder="Label (e.g. My FNB Account)"
            className="w-full h-14 bg-foreground/5 rounded-lg px-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium" />
          <input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)}
            placeholder="Bank name"
            className="w-full h-14 bg-foreground/5 rounded-lg px-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium" />
          <input type="text" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
            placeholder="Account number"
            maxLength={20}
            inputMode="numeric"
            className="w-full h-14 bg-foreground/5 rounded-lg px-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium" />
          <ZappButton onClick={() => addMethodMutation.mutate()} loading={addMethodMutation.isPending}
            disabled={!methodLabel || !bankName || accountNumber.length < 4}>
            Save Payout Method
          </ZappButton>
        </div>
      </BottomSheet>
    </div>
  );
}
