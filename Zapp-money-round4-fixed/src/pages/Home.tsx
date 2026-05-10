import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Zap, Lightbulb, Gift, Send, Plus, Eye, EyeOff, Bell, TrendingUp, ArrowDownToLine, Wallet, ShieldCheck, ShieldAlert } from "lucide-react";
import { useWallet, useProfile } from "@/lib/store";
import { useNotifications } from "@/lib/hooks/useNotifications";
import TransactionItem from "@/components/TransactionItem";
import BottomSheet from "@/components/BottomSheet";
import ZappButton from "@/components/ZappButton";
import SendMoneySheet from "@/components/SendMoneySheet";

const actions = [
  { icon: TrendingUp, label: "Earn", path: "/earn", color: "text-accent" },
  { icon: Send, label: "Send", path: "#send", color: "text-secondary" },
  { icon: ArrowDownToLine, label: "Withdraw", path: "/withdraw", color: "text-primary" },
  { icon: Zap, label: "Airtime", path: "/buy?tab=airtime", color: "text-secondary" },
  { icon: Lightbulb, label: "Electricity", path: "/buy?tab=electricity", color: "text-accent" },
  { icon: Gift, label: "Vouchers", path: "/vouchers", color: "text-primary" },
];

export default function Home() {
  const navigate = useNavigate();
  const wallet = useWallet();
  const profile = useProfile();
  const { unreadCount } = useNotifications();
  const [showBalance, setShowBalance] = useState(true);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("");

  const handleTopUp = async () => {
    const amount = parseFloat(topUpAmount);
    if (!amount || amount < 10) { return; }
    try {
      await wallet.topUp(amount);
    } catch (_err) { /* redirect handled inside mutation */ }
  };

  const handleAction = (path: string) => {
    if (path === "#send") {
      setSendOpen(true);
    } else {
      navigate(path);
    }
  };

  const displayName = profile?.username ? `@${profile.username}` : profile?.full_name || "user";
  const initial = (profile?.full_name?.[0] || profile?.username?.[0] || "Z").toUpperCase();
  const isNewUser = wallet.balance === 0 && wallet.transactions.length === 0;
  const kycStatus = profile?.kyc_status || "unverified";

  return (
    <div className="min-h-screen pb-24 px-5 pt-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-sm text-muted-foreground">welcome back</p>
          <h1 className="text-xl font-bold tracking-tight">{displayName}</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/notifications")} className="relative p-2">
            <Bell size={20} className="text-muted-foreground" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive rounded-full text-[10px] font-bold flex items-center justify-center text-destructive-foreground">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
          <button onClick={() => navigate("/profile")} className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-sm font-bold text-primary">{initial}</span>
          </button>
        </div>
      </div>

      {/* Balance Card */}
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="glass-card rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Wallet size={14} className="text-muted-foreground" />
            <p className="text-xs text-muted-foreground uppercase tracking-widest">wallet balance</p>
          </div>
          <button onClick={() => setShowBalance(!showBalance)} className="text-muted-foreground">
            {showBalance ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
        </div>
        <p className="text-4xl font-extrabold tabular-nums tracking-tight mb-4">
          {showBalance ? `R ${wallet.balance.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}` : "R ••••••"}
        </p>
        <button onClick={() => setTopUpOpen(true)} className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Plus size={16} /> Top Up Wallet
        </button>
      </motion.div>

      {/* KYC Banner */}
      {kycStatus !== "verified" && (
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.05 }}
          className={`glass-card rounded-2xl p-4 mb-6 border flex items-start gap-3 ${
            kycStatus === "pending" ? "border-yellow-500/30" : kycStatus === "rejected" ? "border-destructive/30" : "border-primary/20"
          }`}>
          {kycStatus === "pending" ? (
            <ShieldCheck size={20} className="text-yellow-400 shrink-0 mt-0.5" />
          ) : (
            <ShieldAlert size={20} className="text-primary shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <p className="font-bold text-sm mb-0.5">
              {kycStatus === "pending" ? "Verification in progress" : kycStatus === "rejected" ? "Verification rejected" : "Verify your identity"}
            </p>
            <p className="text-xs text-muted-foreground mb-2">
              {kycStatus === "pending"
                ? "We're reviewing your documents. This usually takes 24 hours."
                : kycStatus === "rejected"
                ? "Your verification was declined. Please try again."
                : "Complete KYC verification to unlock withdrawals and higher limits."}
            </p>
            {kycStatus !== "pending" && (
              <ZappButton onClick={() => navigate("/profile")}>
                {kycStatus === "rejected" ? "Retry Verification" : "Verify Now"}
              </ZappButton>
            )}
          </div>
        </motion.div>
      )}

      {/* New user CTA */}
      {isNewUser && kycStatus === "verified" && (
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.05 }}
          className="glass-card rounded-2xl p-5 mb-6 border border-primary/20">
          <p className="font-bold text-sm mb-1">Welcome to Zapp! 🚀</p>
          <p className="text-xs text-muted-foreground mb-3">Start earning or top up your wallet to get started.</p>
          <div className="flex gap-2">
            <ZappButton onClick={() => navigate("/earn")}>
              <TrendingUp size={14} /> Start Earning
            </ZappButton>
            <ZappButton variant="ghost" onClick={() => navigate("/profile")}>
              Complete Profile
            </ZappButton>
          </div>
        </motion.div>
      )}

      {/* Action Grid */}
      <div className="grid grid-cols-3 gap-2 mb-8">
        {actions.map((action, i) => (
          <motion.button key={action.label} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            transition={{ delay: i * 0.04 }} whileTap={{ scale: 0.95 }}
            onClick={() => handleAction(action.path)}
            className="flex flex-col items-center gap-2 py-4 rounded-2xl glass-card">
            <action.icon size={22} className={action.color} />
            <span className="text-[11px] font-semibold">{action.label}</span>
          </motion.button>
        ))}
      </div>

      {/* Transactions */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">recent</h2>
        {wallet.transactions.length > 0 && (
          <button onClick={() => navigate("/activity")} className="text-xs text-primary font-semibold">see all</button>
        )}
      </div>
      <div className="glass-card rounded-2xl px-4 divide-y divide-foreground/5">
        {wallet.transactions.length === 0 ? (
          <div className="py-10 text-center">
            <Wallet size={28} className="text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">No transactions yet</p>
            <p className="text-muted-foreground/60 text-xs mt-0.5">Your activity will appear here</p>
          </div>
        ) : (
          wallet.transactions.slice(0, 4).map((tx) => (
            <TransactionItem key={tx.id} tx={tx} />
          ))
        )}
      </div>

      {/* Top Up Sheet */}
      <BottomSheet open={topUpOpen} onClose={() => setTopUpOpen(false)} title="Top Up Wallet">
        <div className="flex flex-col gap-4 mt-4 pb-4">
          <div className="grid grid-cols-4 gap-2">
            {[50, 100, 200, 500].map((amt) => (
              <button key={amt} onClick={() => setTopUpAmount(String(amt))}
                className={`h-12 rounded-lg font-bold text-sm transition-all ${
                  topUpAmount === String(amt) ? "bg-primary text-primary-foreground" : "bg-foreground/5 text-foreground"
                }`}>R{amt}</button>
            ))}
          </div>
          <input type="number" value={topUpAmount} onChange={(e) => setTopUpAmount(e.target.value)}
            placeholder="Enter amount (min R10)"
            className="w-full h-14 bg-foreground/5 rounded-lg px-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium" />
          <ZappButton onClick={handleTopUp} loading={wallet.topUpLoading}
            disabled={!topUpAmount || parseFloat(topUpAmount) < 10}>
            Pay R{topUpAmount || "0"} via Card / EFT
          </ZappButton>
        </div>
      </BottomSheet>

      {/* Send Money Sheet */}
      <SendMoneySheet open={sendOpen} onClose={() => setSendOpen(false)} />
    </div>
  );
}
