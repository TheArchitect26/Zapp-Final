import { useState } from "react";
import { motion } from "framer-motion";
import { Clock } from "lucide-react";
import { useWallet } from "@/lib/store";
import TransactionItem from "@/components/TransactionItem";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "survey_reward", label: "Earned" },
  { key: "airtime,electricity,voucher", label: "Purchases" },
  { key: "transfer", label: "Transfers" },
  { key: "withdrawal", label: "Withdrawals" },
  { key: "topup", label: "Top Ups" },
  { key: "coin_conversion", label: "Conversions" },
];

export default function Activity() {
  const { transactions } = useWallet();
  const [filter, setFilter] = useState("all");

  const filtered = filter === "all"
    ? transactions
    : transactions.filter((tx) => filter.split(",").includes(tx.type));

  return (
    <div className="min-h-screen pb-24 px-5 pt-12">
      <h1 className="text-xl font-bold tracking-tight mb-6">activity</h1>

      {/* Filters */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1 scrollbar-hide">
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
              filter === f.key ? "bg-primary text-primary-foreground" : "bg-foreground/5 text-muted-foreground"
            }`}>{f.label}</button>
        ))}
      </div>

      <div className="glass-card rounded-2xl px-4 divide-y divide-foreground/5">
        {filtered.length === 0 ? (
          <div className="py-12 text-center">
            <Clock size={28} className="text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">
              {filter === "all" ? "No transactions yet" : "No transactions in this category"}
            </p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">Your activity will appear here</p>
          </div>
        ) : (
          filtered.map((tx, i) => (
            <motion.div key={tx.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}>
              <TransactionItem tx={tx} />
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
