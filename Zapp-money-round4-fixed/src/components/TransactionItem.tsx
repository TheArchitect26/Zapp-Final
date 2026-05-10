import { Zap, Lightbulb, Gift, ArrowUpCircle, Send, Coins, ArrowDownLeft, Banknote } from "lucide-react";
import { zcToDisplay, type CoinRate } from "@/lib/coins";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const iconMap: Record<string, { icon: any; color: string }> = {
  airtime:        { icon: Zap,          color: "text-secondary" },
  electricity:    { icon: Lightbulb,    color: "text-accent" },
  voucher:        { icon: Gift,         color: "text-primary" },
  topup:          { icon: ArrowUpCircle,color: "text-accent" },
  transfer:       { icon: Send,         color: "text-secondary" },
  survey_reward:  { icon: Coins,        color: "text-accent" },
  coin_conversion:{ icon: Coins,        color: "text-primary" },
  withdrawal:     { icon: Banknote,     color: "text-destructive" },
};

const ZAR_FALLBACK: CoinRate = { zc_per_unit: 100, symbol: "R", display_decimals: 2, currency_code: "ZAR" };

interface TransactionItemProps {
  tx: {
    id: string;
    type: string;
    description: string;
    amount: number;
    created_at: string;
    status: string;
  };
  rate?: CoinRate;
}

export default function TransactionItem({ tx, rate = ZAR_FALLBACK }: TransactionItemProps) {
  const txType = tx.type as keyof typeof iconMap;
  const { icon: Icon, color } = iconMap[txType] || iconMap.airtime;
  const isPositive = tx.amount > 0;
  const date = new Date(tx.created_at).toLocaleDateString("en-ZA", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
  const displayAmount = zcToDisplay(Math.abs(tx.amount), rate);

  return (
    <div className="flex items-center gap-3 py-3">
      <div className={`w-10 h-10 rounded-xl bg-foreground/5 flex items-center justify-center ${color}`}>
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{tx.description}</p>
        <div className="flex items-center gap-1.5">
          <p className="text-xs text-muted-foreground">{date}</p>
          {tx.status !== "completed" && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
              tx.status === "failed" ? "bg-destructive/20 text-destructive" : "bg-yellow-500/20 text-yellow-400"
            }`}>{tx.status}</span>
          )}
        </div>
      </div>
      <span className={`text-sm font-bold tabular-nums ${isPositive ? "text-accent" : "text-foreground"}`}>
        {isPositive ? "+" : "-"}{displayAmount}
      </span>
    </div>
  );
}
