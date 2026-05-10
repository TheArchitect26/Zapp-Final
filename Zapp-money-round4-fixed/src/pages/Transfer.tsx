import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, ArrowRight, Check, Loader2, AlertCircle, Clock, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useWallet, useProfile } from "@/lib/store";
import { useCorridors, useSendInternational, useInternationalTransfers } from "@/lib/hooks/useTransfers";
import ZappButton from "@/components/ZappButton";
import { toast } from "sonner";

type Step = "select" | "amount" | "recipient" | "confirm" | "execute" | "history";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400",
  processing: "bg-secondary/20 text-secondary",
  completed: "bg-accent/20 text-accent",
  failed: "bg-destructive/20 text-destructive",
};

const FLAG: Record<string, string> = { ZAR: "🇿🇦", USD: "🇺🇸", KES: "🇰🇪", NGN: "🇳🇬", GBP: "🇬🇧", EUR: "🇪🇺", ZMW: "🇿🇲", MWK: "🇲🇼" };

export default function Transfer() {
  const navigate = useNavigate();
  const wallet = useWallet();
  const profile = useProfile();
  const { corridors, isLoading: corridorsLoading } = useCorridors();
  const { transfers } = useInternationalTransfers();
  const sendMutation = useSendInternational();

  const [step, setStep] = useState<Step>("select");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedCorridor, setSelectedCorridor] = useState<any>(null);
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [success, setSuccess] = useState(false);

  const kycVerified = profile?.kyc_status === "verified";

  const calc = useMemo(() => {
    if (!selectedCorridor || !amount) return null;
    const src = parseFloat(amount);
    if (!src || src <= 0) return null;
    const fee = (src * (selectedCorridor.fee_percentage ?? 2.5) / 100) + (selectedCorridor.flat_fee ?? 0);
    const net = src - fee;
    const srcRate = selectedCorridor.source?.zc_rate ?? 100;
    const dstRate = selectedCorridor.destination?.zc_rate ?? 100;
    const destAmount = (net * srcRate) / dstRate;
    return { src, fee, net, destAmount };
  }, [selectedCorridor, amount]);

  const srcCode = selectedCorridor?.source?.code ?? "ZAR";
  const dstCode = selectedCorridor?.destination?.code ?? "";
  const dstSymbol = selectedCorridor?.destination?.symbol ?? "";
  const minAmt = selectedCorridor?.min_amount ?? 10;
  const maxAmt = selectedCorridor?.max_amount ?? 50000;
  const destType = selectedCorridor?.destination?.country === "KE" ? "phone" : "account";

  const amountValid = calc && calc.src >= minAmt && calc.src <= maxAmt && calc.src <= wallet.balance;

  const handleSend = async () => {
    if (!selectedCorridor || !calc || !recipient) return;
    try {
      await sendMutation.mutateAsync({
        recipient,
        sourceAmount: calc.src,
        destinationCurrency: dstCode,
        corridorId: selectedCorridor.id,
      });
      setSuccess(true);
      setStep("execute");
    } catch (err) {
      toast.error((err as Error).message || "Transfer failed");
    }
  };

  const reset = () => { setStep("select"); setSelectedCorridor(null); setAmount(""); setRecipient(""); setSuccess(false); };

  return (
    <div className="min-h-screen pb-24 px-5 pt-12">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        {step !== "select" && step !== "history" && (
          <button onClick={() => setStep(step === "amount" ? "select" : step === "recipient" ? "amount" : step === "confirm" ? "recipient" : "select")}>
            <ChevronLeft size={20} className="text-muted-foreground" />
          </button>
        )}
        <h1 className="text-xl font-bold tracking-tight flex-1">
          {step === "history" ? "Transfer History" : "Send Money"}
        </h1>
        <button onClick={() => setStep(step === "history" ? "select" : "history")}
          className="text-xs text-primary font-semibold">
          {step === "history" ? "Send" : "History"}
        </button>
      </div>

      <AnimatePresence mode="wait">

        {/* STEP 1 — Select corridor */}
        {step === "select" && (
          <motion.div key="select" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
            <p className="text-sm text-muted-foreground mb-4">Choose a destination</p>
            {corridorsLoading ? (
              <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>
            ) : corridors.length === 0 ? (
              <div className="glass-card rounded-2xl p-8 text-center">
                <Globe size={32} className="text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No corridors available</p>
              </div>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ) : corridors.map((c: any) => (
              <button key={c.id} onClick={() => { setSelectedCorridor(c); setStep("amount"); }}
                className="glass-card rounded-2xl p-4 w-full flex items-center gap-4 text-left">
                <span className="text-2xl">{FLAG[c.source?.code] ?? "🌍"}</span>
                <ArrowRight size={14} className="text-muted-foreground" />
                <span className="text-2xl">{FLAG[c.destination?.code] ?? "🌍"}</span>
                <div className="flex-1">
                  <p className="font-bold text-sm">{c.source?.code} → {c.destination?.code}</p>
                  <p className="text-xs text-muted-foreground">{c.fee_percentage}% fee · min {c.source?.symbol}{c.min_amount}</p>
                </div>
                <ChevronLeft size={16} className="text-muted-foreground rotate-180" />
              </button>
            ))}
          </motion.div>
        )}

        {/* STEP 2 — Enter amount */}
        {step === "amount" && (
          <motion.div key="amount" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <div className="glass-card rounded-2xl p-4 flex items-center gap-3">
              <span className="text-xl">{FLAG[srcCode]}</span>
              <span className="font-bold">{srcCode} → {dstCode}</span>
              <span className="text-xl ml-auto">{FLAG[dstCode]}</span>
            </div>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder={`Amount in ${srcCode} (min ${minAmt})`}
              className="w-full h-14 bg-foreground/5 rounded-lg px-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium" />
            {calc && (
              <div className="bg-foreground/5 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Fee</span><span>R{calc.fee.toFixed(2)}</span></div>
                <div className="flex justify-between font-bold border-t border-foreground/10 pt-1 mt-1">
                  <span>Recipient gets</span><span>{dstSymbol}{calc.destAmount.toFixed(2)} {dstCode}</span>
                </div>
              </div>
            )}
            {calc && calc.src > wallet.balance && <p className="text-xs text-destructive">Insufficient balance</p>}
            {calc && calc.src < minAmt && <p className="text-xs text-destructive">Minimum is R{minAmt}</p>}
            {calc && calc.src > maxAmt && <p className="text-xs text-destructive">Maximum is R{maxAmt}</p>}
            <ZappButton onClick={() => setStep("recipient")} disabled={!amountValid}>Continue</ZappButton>
          </motion.div>
        )}

        {/* STEP 3 — Recipient details */}
        {step === "recipient" && (
          <motion.div key="recipient" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {destType === "phone" ? "Enter recipient's M-Pesa phone number" : "Enter recipient's bank account number"}
            </p>
            <input value={recipient} onChange={(e) => setRecipient(e.target.value)}
              placeholder={destType === "phone" ? "+254 7XX XXX XXX" : "Account number"}
              inputMode={destType === "phone" ? "tel" : "numeric"}
              className="w-full h-14 bg-foreground/5 rounded-lg px-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium" />
            <ZappButton onClick={() => setStep("confirm")} disabled={!recipient.trim()}>Continue</ZappButton>
          </motion.div>
        )}

        {/* STEP 4 — Confirm + KYC gate */}
        {step === "confirm" && (
          <motion.div key="confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <div className="glass-card rounded-2xl p-5 space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">You send</span><span className="font-bold">R{calc?.src.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Fee</span><span>R{calc?.fee.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Recipient gets</span><span className="font-bold">{dstSymbol}{calc?.destAmount.toFixed(2)} {dstCode}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">To</span><span>{recipient}</span></div>
            </div>
            {!kycVerified ? (
              <div className="glass-card rounded-2xl p-4 border border-destructive/20 space-y-2">
                <div className="flex items-center gap-2 text-destructive text-sm font-semibold">
                  <AlertCircle size={16} /> Identity verification required
                </div>
                <p className="text-xs text-muted-foreground">You must verify your identity before sending international transfers.</p>
                <ZappButton onClick={() => navigate("/kyc")}>Verify Identity</ZappButton>
              </div>
            ) : (
              <ZappButton onClick={handleSend} loading={sendMutation.isPending}>Confirm Transfer</ZappButton>
            )}
          </motion.div>
        )}

        {/* STEP 5 — Success */}
        {step === "execute" && success && (
          <motion.div key="execute" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center space-y-4 pt-8">
            <Check size={64} className="text-accent mx-auto" />
            <p className="font-extrabold text-2xl">Transfer Sent!</p>
            <p className="text-sm text-muted-foreground">
              {dstSymbol}{calc?.destAmount.toFixed(2)} {dstCode} is on its way to {recipient}.
              {selectedCorridor?.estimated_delivery ? ` Estimated delivery: ${selectedCorridor.estimated_delivery}.` : " Usually 1–2 business days."}
            </p>
            <ZappButton onClick={reset}>Send Another</ZappButton>
          </motion.div>
        )}

        {/* STEP 6 — History */}
        {step === "history" && (
          <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            {transfers.length === 0 ? (
              <div className="glass-card rounded-2xl p-8 text-center">
                <Clock size={28} className="text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No transfers yet</p>
              </div>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ) : transfers.map((t: any) => (
              <div key={t.id} className="glass-card rounded-2xl p-4 flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold">R{t.source_amount?.toFixed(2)} → {t.destination_currency}</p>
                  <p className="text-xs text-muted-foreground">{t.recipient_identifier} · {new Date(t.created_at).toLocaleDateString()}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize ${STATUS_COLORS[t.status] || ""}`}>{t.status}</span>
              </div>
            ))}
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
