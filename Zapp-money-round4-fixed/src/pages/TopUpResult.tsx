import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ZappButton from "@/components/ZappButton";

export default function TopUpResult() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const resourcePath = params.get("resourcePath") || "";
  const [status, setStatus] = useState<"loading" | "completed" | "failed">("loading");
  const [amount, setAmount] = useState<number | null>(null);

  useEffect(() => {
    if (!resourcePath) { setStatus("failed"); return; }

    // Peach appends merchantTransactionId as a query param on the result URL
    const merchantTxId = params.get("merchantTransactionId") || "";
    if (!merchantTxId) { setStatus("failed"); return; }

    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      const { data } = await supabase
        .from("topup_requests")
        .select("status, amount")
        .eq("merchant_transaction_id", merchantTxId)
        .maybeSingle();

      if (data?.status === "completed") {
        setAmount(data.amount);
        setStatus("completed");
        clearInterval(poll);
      } else if (data?.status === "failed" || attempts >= 15) {
        setStatus("failed");
        clearInterval(poll);
      }
    }, 2000);

    return () => clearInterval(poll);
  }, [resourcePath, params]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 pb-24">
      {status === "loading" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-4">
          <Loader2 size={48} className="animate-spin text-primary mx-auto" />
          <p className="font-bold text-lg">Processing your payment…</p>
          <p className="text-sm text-muted-foreground">This usually takes a few seconds</p>
        </motion.div>
      )}
      {status === "completed" && (
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center space-y-4">
          <CheckCircle size={64} className="text-accent mx-auto" />
          <p className="font-extrabold text-2xl">R{amount?.toFixed(2)} Added!</p>
          <p className="text-sm text-muted-foreground">Your wallet has been topped up successfully.</p>
          <ZappButton onClick={() => navigate("/")}>Back to Home</ZappButton>
        </motion.div>
      )}
      {status === "failed" && (
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center space-y-4">
          <XCircle size={64} className="text-destructive mx-auto" />
          <p className="font-extrabold text-2xl">Payment Failed</p>
          <p className="text-sm text-muted-foreground">Your payment could not be processed. No money was taken.</p>
          <ZappButton onClick={() => navigate("/")}>Try Again</ZappButton>
        </motion.div>
      )}
    </div>
  );
}
