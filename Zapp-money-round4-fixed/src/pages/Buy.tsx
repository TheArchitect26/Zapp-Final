import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Lightbulb, Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { useWallet } from "@/lib/store";
import { useNetworks } from "@/lib/hooks/useNetworks";
import ZappButton from "@/components/ZappButton";

export default function Buy() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "electricity" ? "electricity" : "airtime";
  const [tab, setTab] = useState<"airtime" | "electricity">(initialTab);

  return (
    <div className="min-h-screen pb-24 px-5 pt-12">
      <h1 className="text-xl font-bold tracking-tight mb-6">buy</h1>
      <div className="flex gap-2 mb-6">
        {(["airtime", "electricity"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 h-11 rounded-lg font-semibold text-sm capitalize transition-all ${
              tab === t ? "bg-primary text-primary-foreground" : "bg-foreground/5 text-muted-foreground"
            }`}
          >
            {t === "airtime" ? <Zap size={14} className="inline mr-1.5 -mt-0.5" /> : <Lightbulb size={14} className="inline mr-1.5 -mt-0.5" />}
            {t}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        {tab === "airtime" ? (
          <motion.div key="airtime" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
            <AirtimeForm />
          </motion.div>
        ) : (
          <motion.div key="electricity" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <ElectricityForm />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AirtimeForm() {
  const wallet = useWallet();
  const { data: networks = [] } = useNetworks();
  const [network, setNetwork] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handlePurchase = async () => {
    const amt = parseFloat(amount);
    if (!network || !phone || !amt) return;
    setLoading(true);
    try {
      await wallet.addTransaction({ type: "airtime", description: `${network} Airtime`, amount: amt });
      setSuccess(true);
    } catch (err) {
      toast.error((err as Error)?.message || "Purchase failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-12">
        <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-4">
          <Check size={32} className="text-accent" />
        </div>
        <h3 className="text-lg font-bold mb-1">airtime sent!</h3>
        <p className="text-sm text-muted-foreground">R{amount} {network} airtime to {phone}</p>
        <ZappButton variant="ghost" className="mt-6" onClick={() => { setSuccess(false); setNetwork(""); setPhone(""); setAmount(""); }}>
          buy more
        </ZappButton>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {networks.map((n) => (
          <button
            key={n.id}
            onClick={() => setNetwork(n.name)}
            className={`h-12 rounded-lg font-semibold text-sm transition-all ${
              network === n.name ? n.color_class + " ring-1 ring-foreground/10" : "bg-foreground/5 text-muted-foreground"
            }`}
          >
            {n.name}
          </button>
        ))}
      </div>
      <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number"
        className="w-full h-14 bg-foreground/5 rounded-lg px-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium" />
      <div className="grid grid-cols-4 gap-2">
        {[10, 30, 50, 100].map((a) => (
          <button key={a} onClick={() => setAmount(String(a))}
            className={`h-11 rounded-lg font-bold text-sm transition-all ${amount === String(a) ? "bg-primary text-primary-foreground" : "bg-foreground/5 text-foreground"}`}>
            R{a}
          </button>
        ))}
      </div>
      <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Custom amount"
        className="w-full h-14 bg-foreground/5 rounded-lg px-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium" />
      <ZappButton onClick={handlePurchase} loading={loading} disabled={!network || !phone || !amount}>
        Pay with Wallet · R{amount || "0"}
      </ZappButton>
    </div>
  );
}

function ElectricityForm() {
  const wallet = useWallet();
  const [meter, setMeter] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState("");
  const [copied, setCopied] = useState(false);

  const handlePurchase = async () => {
    const amt = parseFloat(amount);
    if (!meter || !amt) return;
    setLoading(true);
    try {
      // Backend confirmation first — token is generated only on success
      await wallet.addTransaction({ type: "electricity", description: "Electricity Token", amount: amt });

      // Use CSPRNG (crypto.getRandomValues) — never Math.random() for tokens
      const bytes = new Uint8Array(20);
      crypto.getRandomValues(bytes);
      const genToken = Array.from(bytes, (b) => b % 10)
        .join("")
        .replace(/(.{4})/g, "$1 ")
        .trim();

      setToken(genToken);
    } catch (err) {
      toast.error((err as Error)?.message || "Purchase failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const copyToken = () => {
    navigator.clipboard.writeText(token.replace(/\s/g, ""));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (token) {
    return (
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-8">
        <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-4">
          <Lightbulb size={32} className="text-accent" />
        </div>
        <h3 className="text-lg font-bold mb-1">token ready!</h3>
        <p className="text-sm text-muted-foreground mb-6">Meter: {meter}</p>
        <div className="glass-card rounded-2xl p-5 mb-4">
          <p className="text-xs text-muted-foreground mb-2 uppercase tracking-widest">your token</p>
          <p className="text-2xl font-mono-token font-bold tracking-wider">{token}</p>
        </div>
        <ZappButton variant={copied ? "accent" : "ghost"} onClick={copyToken}>
          {copied ? <><Check size={16} /> Copied!</> : <><Copy size={16} /> Copy Token</>}
        </ZappButton>
        <ZappButton variant="ghost" className="mt-2" onClick={() => { setToken(""); setMeter(""); setAmount(""); }}>
          buy more
        </ZappButton>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      <input type="text" value={meter} onChange={(e) => setMeter(e.target.value)} placeholder="Meter number"
        className="w-full h-14 bg-foreground/5 rounded-lg px-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium" />
      <div className="grid grid-cols-3 gap-2">
        {[50, 100, 200].map((a) => (
          <button key={a} onClick={() => setAmount(String(a))}
            className={`h-11 rounded-lg font-bold text-sm transition-all ${amount === String(a) ? "bg-primary text-primary-foreground" : "bg-foreground/5 text-foreground"}`}>
            R{a}
          </button>
        ))}
      </div>
      <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Custom amount"
        className="w-full h-14 bg-foreground/5 rounded-lg px-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium" />
      <ZappButton onClick={handlePurchase} loading={loading} disabled={!meter || !amount}>
        Pay with Wallet · R{amount || "0"}
      </ZappButton>
    </div>
  );
}
