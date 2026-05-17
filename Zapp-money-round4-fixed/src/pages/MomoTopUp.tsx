import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Smartphone, Check, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import ZappButton from "@/components/ZappButton";
import { useMomoTopUp, useMomoValidate } from "@/lib/hooks/useMomo";

export default function MomoTopUp() {
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const { initiate, status, referenceId, reset } = useMomoTopUp();
  const { data: validation } = useMomoValidate(phone);

  const parsedAmount = parseFloat(amount) || 0;
  const txStatus = status.data?.status;

  const handleSubmit = async () => {
    if (!phone || parsedAmount <= 0) return;
    try {
      await initiate.mutateAsync({ amount: parsedAmount, phone });
      toast.success("Request sent — approve on your MoMo phone");
    } catch (err) {
      toast.error((err as Error).message || "MoMo top-up failed");
    }
  };

  // Success state
  if (txStatus === "SUCCESSFUL") {
    return (
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-12">
        <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-4">
          <Check size={32} className="text-accent" />
        </div>
        <h3 className="text-lg font-bold mb-1">top-up successful!</h3>
        <p className="text-sm text-muted-foreground mb-6">{amount} added to your wallet via MoMo</p>
        <ZappButton variant="ghost" onClick={() => { reset(); setPhone(""); setAmount(""); }}>
          top up again
        </ZappButton>
      </motion.div>
    );
  }

  // Pending / processing state
  if (referenceId && txStatus !== "FAILED") {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12 space-y-4">
        <Loader2 size={40} className="animate-spin text-primary mx-auto" />
        <p className="font-bold">waiting for approval…</p>
        <p className="text-sm text-muted-foreground">Check your phone and approve the MoMo request</p>
        <p className="text-xs text-muted-foreground/60">This page updates automatically</p>
      </motion.div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div key="form" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
        className="space-y-4">

        {txStatus === "FAILED" && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3">
            <AlertCircle size={16} /> Payment declined — {status.data?.reason || "please try again"}
          </div>
        )}

        <div className="relative">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
            placeholder="MoMo phone number (MSISDN)"
            className="w-full h-14 bg-foreground/5 rounded-lg px-4 pr-10 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium"
          />
          {phone.length >= 9 && (
            <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold ${validation?.active ? "text-accent" : "text-muted-foreground"}`}>
              {validation?.active ? "✓ active" : "checking…"}
            </span>
          )}
        </div>

        <div className="grid grid-cols-4 gap-2">
          {[5, 10, 20, 50].map((a) => (
            <button key={a} onClick={() => setAmount(String(a))}
              className={`h-11 rounded-lg font-bold text-sm transition-all ${amount === String(a) ? "bg-primary text-primary-foreground" : "bg-foreground/5 text-foreground"}`}>
              {a}
            </button>
          ))}
        </div>

        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Custom amount"
          className="w-full h-14 bg-foreground/5 rounded-lg px-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium"
        />

        <ZappButton
          onClick={handleSubmit}
          loading={initiate.isPending}
          disabled={!phone || parsedAmount <= 0}
        >
          <Smartphone size={16} /> Pay with MoMo · {parsedAmount > 0 ? parsedAmount : "0"}
        </ZappButton>

        <p className="text-xs text-center text-muted-foreground">
          You'll receive a USSD prompt on {phone || "your phone"} to approve
        </p>
      </motion.div>
    </AnimatePresence>
  );
}
