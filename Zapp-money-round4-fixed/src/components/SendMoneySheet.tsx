import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Check, ScanLine, User, AlertCircle } from "lucide-react";
import { useWallet } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import BottomSheet from "@/components/BottomSheet";
import ZappButton from "@/components/ZappButton";
import QRScanner from "@/components/QRScanner";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  prefillUsername?: string;
}

type Step = "input" | "confirm" | "success";

export default function SendMoneySheet({ open, onClose, prefillUsername }: Props) {
  const wallet = useWallet();
  const [recipient, setRecipient] = useState(prefillUsername || "");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [step, setStep] = useState<Step>("input");
  const [scannerOpen, setScannerOpen] = useState(false);

  // Recipient verification
  const [recipientProfile, setRecipientProfile] = useState<{ full_name: string | null; username: string | null } | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);

  const verifyRecipient = useCallback(async (username: string) => {
    const clean = username.replace("@", "").trim();
    if (!clean) return;
    setVerifying(true);
    setVerified(false);
    setRecipientProfile(null);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, username")
        .eq("username", clean)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setRecipientProfile(data);
        setVerified(true);
      } else {
        toast.error("User not found");
      }
    } catch {
      toast.error("Could not verify user");
    } finally {
      setVerifying(false);
    }
  }, []);

  const handleRecipientBlur = () => {
    if (recipient.replace("@", "").trim() && !verified) {
      verifyRecipient(recipient);
    }
  };

  const handleQRScan = (username: string) => {
    setRecipient(username);
    setScannerOpen(false);
    verifyRecipient(username);
  };

  const goToConfirm = () => {
    const amt = parseFloat(amount);
    if (!verified || !amt || amt <= 0) {
      toast.error("Please verify recipient and enter a valid amount");
      return;
    }
    if (amt > wallet.balance) {
      toast.error("Insufficient balance");
      return;
    }
    setStep("confirm");
  };

  const handleSend = async () => {
    const amt = parseFloat(amount);
    try {
      await wallet.transfer({
        recipientUsername: recipient.replace("@", "").trim(),
        amount: amt,
        message,
      });
      setStep("success");
    } catch (err) {
      toast.error((err as Error).message || "Transfer failed");
    }
  };

  const handleClose = () => {
    setRecipient("");
    setAmount("");
    setMessage("");
    setStep("input");
    setRecipientProfile(null);
    setVerified(false);
    onClose();
  };

  return (
    <>
      <BottomSheet open={open} onClose={handleClose} title="Send Money">
        <AnimatePresence mode="wait">
          {step === "success" ? (
            <motion.div key="success" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-4">
                <Check size={32} className="text-accent" />
              </div>
              <h3 className="text-lg font-bold mb-1">money sent!</h3>
              <p className="text-sm text-muted-foreground">R{amount} to @{recipient.replace("@", "")}</p>
              <ZappButton variant="ghost" className="mt-6" onClick={handleClose}>done</ZappButton>
            </motion.div>
          ) : step === "confirm" ? (
            <motion.div key="confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 mt-4">
              <div className="glass-card rounded-2xl p-5 text-center">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-3">
                  <User size={20} className="text-primary" />
                </div>
                <p className="font-bold">{recipientProfile?.full_name || `@${recipient.replace("@", "")}`}</p>
                <p className="text-xs text-muted-foreground">@{recipient.replace("@", "")}</p>
                <p className="text-3xl font-extrabold mt-4 tabular-nums">R{parseFloat(amount).toFixed(2)}</p>
                {message && <p className="text-xs text-muted-foreground mt-2">"{message}"</p>}
              </div>
              <div className="flex items-center gap-2 p-3 rounded-xl bg-yellow-500/10 text-yellow-400">
                <AlertCircle size={16} className="shrink-0" />
                <p className="text-xs">Please verify the recipient before confirming</p>
              </div>
              <ZappButton onClick={handleSend} loading={wallet.transferLoading}>
                <Send size={16} /> Confirm & Send
              </ZappButton>
              <ZappButton variant="ghost" onClick={() => setStep("input")}>Go Back</ZappButton>
            </motion.div>
          ) : (
            <motion.div key="input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 mt-4">
              {/* Recipient input */}
              <div className="relative">
                <input
                  type="text"
                  value={recipient}
                  onChange={(e) => { setRecipient(e.target.value); setVerified(false); setRecipientProfile(null); }}
                  onBlur={handleRecipientBlur}
                  placeholder="Username (e.g. celumusa)"
                  className="w-full h-14 bg-foreground/5 rounded-lg px-4 pr-12 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium"
                />
                <button
                  onClick={() => setScannerOpen(true)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-primary/10 text-primary"
                >
                  <ScanLine size={18} />
                </button>
              </div>

              {/* Verified badge */}
              {verified && recipientProfile && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-accent/10">
                  <Check size={14} className="text-accent" />
                  <span className="text-xs font-semibold text-accent">
                    {recipientProfile.full_name || `@${recipientProfile.username}`}
                  </span>
                </motion.div>
              )}

              {/* Amount quick select */}
              <div className="grid grid-cols-3 gap-2">
                {[50, 100, 200].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setAmount(String(amt))}
                    className={`h-12 rounded-lg font-bold text-sm transition-all ${
                      amount === String(amt) ? "bg-secondary text-secondary-foreground" : "bg-foreground/5 text-foreground"
                    }`}
                  >
                    R{amt}
                  </button>
                ))}
              </div>

              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Amount"
                className="w-full h-14 bg-foreground/5 rounded-lg px-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium"
              />
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Add a message (optional) 💸"
                className="w-full h-12 bg-foreground/5 rounded-lg px-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
              />
              <ZappButton
                onClick={goToConfirm}
                disabled={!verified || !amount || parseFloat(amount) <= 0}
                loading={verifying}
              >
                <Send size={16} /> Send R{amount || "0"}
              </ZappButton>
            </motion.div>
          )}
        </AnimatePresence>
      </BottomSheet>

      <QRScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onScan={handleQRScan} />
    </>
  );
}
