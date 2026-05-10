/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { BarChart3, ShoppingCart, Wifi, ClipboardList, Users, LogOut, ChevronRight, ToggleLeft, ToggleRight, Plus, Coins, Globe, Route, DollarSign, ArrowDownToLine, ShieldCheck, GraduationCap } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useAdminTransactions, useAdminProfiles, useAdminNetworks, useAdminVoucherBrands, useAdminSurveys } from "@/lib/hooks/useAdmin";
import ZappButton from "@/components/ZappButton";
import { toast } from "sonner";
import EarnOpportunitiesTab from "./tabs/EarnOpportunitiesTab";
import CurrenciesTab from "./tabs/CurrenciesTab";
import CorridorsTab from "./tabs/CorridorsTab";
import FeesTab from "./tabs/FeesTab";
import WithdrawalsTab from "./tabs/WithdrawalsTab";
import KYCTab from "./tabs/KYCTab";
import AcademyTab from "./tabs/AcademyTab";

type Tab = "overview" | "transactions" | "networks" | "vouchers" | "surveys" | "users" | "earn" | "currencies" | "corridors" | "fees" | "withdrawals" | "kyc" | "academy";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tabs: { id: Tab; label: string; icon: any }[] = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "transactions", label: "Transactions", icon: ClipboardList },
  { id: "users", label: "Users", icon: Users },
  { id: "earn", label: "Earn", icon: Coins },
  { id: "academy", label: "Academy", icon: GraduationCap },
  { id: "networks", label: "Networks", icon: Wifi },
  { id: "vouchers", label: "Vouchers", icon: ShoppingCart },
  { id: "surveys", label: "Surveys", icon: ClipboardList },
  { id: "currencies", label: "Currencies", icon: Globe },
  { id: "corridors", label: "Corridors", icon: Route },
  { id: "fees", label: "Fees", icon: DollarSign },
  { id: "withdrawals", label: "Withdrawals", icon: ArrowDownToLine },
  { id: "kyc", label: "KYC", icon: ShieldCheck },
];

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/admin/login");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-extrabold tracking-tight">zapp admin</h1>
          <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-destructive font-semibold">
            <LogOut size={16} /> Logout
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar pb-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 h-10 rounded-lg font-semibold text-sm whitespace-nowrap transition-all ${
                activeTab === tab.id ? "bg-primary text-primary-foreground" : "bg-foreground/5 text-muted-foreground"
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "overview" && <OverviewTab />}
        {activeTab === "transactions" && <TransactionsTab />}
        {activeTab === "users" && <UsersTab />}
        {activeTab === "earn" && <EarnOpportunitiesTab />}
        {activeTab === "networks" && <NetworksTab />}
        {activeTab === "vouchers" && <VouchersTab />}
        {activeTab === "surveys" && <SurveysTab />}
        {activeTab === "currencies" && <CurrenciesTab />}
        {activeTab === "corridors" && <CorridorsTab />}
        {activeTab === "fees" && <FeesTab />}
        {activeTab === "withdrawals" && <WithdrawalsTab />}
        {activeTab === "kyc" && <KYCTab />}
        {activeTab === "academy" && <AcademyTab />}
      </div>
    </div>
  );
}

function OverviewTab() {
  const { data: txResult } = useAdminTransactions(0, 50);
  const { data: profileResult } = useAdminProfiles(0, 50);

  const transactions = txResult?.data ?? [];
  const totalTxCount = txResult?.total ?? 0;
  const totalUsers   = profileResult?.total ?? 0;

  // Volume from the current page only — a server-side aggregate RPC is needed for exact total
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pageVolume = transactions.reduce((sum: number, t: any) => sum + Math.abs(t.amount), 0);

  const stats = [
    { label: "Total Users",        value: totalUsers.toLocaleString() },
    { label: "Total Transactions", value: totalTxCount.toLocaleString() },
    { label: "Page Volume (est.)", value: `R${pageVolume.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}` },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {stats.map((s) => (
        <div key={s.label} className="glass-card rounded-2xl p-6">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">{s.label}</p>
          <p className="text-2xl font-extrabold">{s.value}</p>
        </div>
      ))}
    </div>
  );
}

function TransactionsTab() {
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;
  const { data: result } = useAdminTransactions(page, PAGE_SIZE);
  const transactions = result?.data ?? [];
  const total = result?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total.toLocaleString()} total transactions</span>
        <div className="flex items-center gap-2">
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
            className="px-3 h-8 rounded-lg bg-foreground/5 disabled:opacity-30 font-semibold">←</button>
          <span>Page {page + 1} / {Math.max(1, totalPages)}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
            className="px-3 h-8 rounded-lg bg-foreground/5 disabled:opacity-30 font-semibold">→</button>
        </div>
      </div>
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-foreground/5">
                <th className="text-left p-3 text-muted-foreground font-semibold">Type</th>
                <th className="text-left p-3 text-muted-foreground font-semibold">Description</th>
                <th className="text-right p-3 text-muted-foreground font-semibold">Amount</th>
                <th className="text-left p-3 text-muted-foreground font-semibold">Status</th>
                <th className="text-left p-3 text-muted-foreground font-semibold">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/5">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {transactions.map((tx: any) => (
                <tr key={tx.id}>
                  <td className="p-3 capitalize">{tx.type}</td>
                  <td className="p-3 text-muted-foreground">{tx.description}</td>
                  <td className={`p-3 text-right font-bold ${tx.amount >= 0 ? "text-accent" : "text-destructive"}`}>
                    R{Math.abs(tx.amount).toFixed(2)}
                  </td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      tx.status === "completed" ? "bg-accent/20 text-accent" : tx.status === "failed" ? "bg-destructive/20 text-destructive" : "bg-yellow-500/20 text-yellow-400"
                    }`}>{tx.status}</span>
                  </td>
                  <td className="p-3 text-muted-foreground text-xs">{new Date(tx.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function NetworksTab() {
  const { networks, toggleStatus } = useAdminNetworks();

  return (
    <div className="space-y-3">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {networks.map((n: any) => (
        <div key={n.id} className="glass-card rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="font-bold text-sm">{n.name}</p>
            <p className="text-xs text-muted-foreground">{n.type}</p>
          </div>
          <button onClick={() => toggleStatus({ id: n.id, status: n.status })}>
            {n.status === "active" ? (
              <ToggleRight size={28} className="text-accent" />
            ) : (
              <ToggleLeft size={28} className="text-muted-foreground" />
            )}
          </button>
        </div>
      ))}
    </div>
  );
}

function VouchersTab() {
  const { brands, toggleStatus, addBrand, addProduct } = useAdminVoucherBrands();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("shopping");

  const handleAdd = async () => {
    if (!newName) return;
    try {
      await addBrand({ name: newName, category: newCategory, color_class: "bg-foreground/10 text-foreground" });
      setNewName("");
      setShowAdd(false);
      toast.success("Brand added");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="space-y-3">
      <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-2 text-sm font-semibold text-primary">
        <Plus size={16} /> Add Brand
      </button>
      {showAdd && (
        <div className="glass-card rounded-2xl p-4 space-y-3">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Brand name"
            className="w-full h-10 bg-foreground/5 rounded-lg px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
          <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}
            className="w-full h-10 bg-foreground/5 rounded-lg px-3 text-sm text-foreground focus:outline-none">
            <option value="shopping">Shopping</option>
            <option value="gaming">Gaming</option>
            <option value="entertainment">Entertainment</option>
            <option value="betting">Betting</option>
          </select>
          <ZappButton onClick={handleAdd}>Add Brand</ZappButton>
        </div>
      )}
      {brands.map((b: any) => (
        <div key={b.id} className="glass-card rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="font-bold text-sm">{b.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{b.category}</p>
            </div>
            <button onClick={() => toggleStatus({ id: b.id, status: b.status })}>
              {b.status === "active" ? (
                <ToggleRight size={28} className="text-accent" />
              ) : (
                <ToggleLeft size={28} className="text-muted-foreground" />
              )}
            </button>
          </div>
          <div className="flex gap-2 flex-wrap">
            {b.voucher_products?.map((p: any) => (
              <span key={p.id} className="text-xs bg-foreground/5 px-2 py-1 rounded-lg">R{p.value}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SurveysTab() {
  const { surveys, toggleActive } = useAdminSurveys();

  return (
    <div className="space-y-3">
      {surveys.map((s: any) => (
        <div key={s.id} className="glass-card rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="font-bold text-sm">{s.title}</p>
            <p className="text-xs text-muted-foreground">{s.reward_coins} ZC · {s.estimated_minutes} min</p>
          </div>
          <button onClick={() => toggleActive({ id: s.id, active: s.active })}>
            {s.active ? (
              <ToggleRight size={28} className="text-accent" />
            ) : (
              <ToggleLeft size={28} className="text-muted-foreground" />
            )}
          </button>
        </div>
      ))}
    </div>
  );
}

function UsersTab() {
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;
  const { data: result } = useAdminProfiles(page, PAGE_SIZE);
  const profiles = result?.data ?? [];
  const total = result?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total.toLocaleString()} total users</span>
        <div className="flex items-center gap-2">
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
            className="px-3 h-8 rounded-lg bg-foreground/5 disabled:opacity-30 font-semibold">←</button>
          <span>Page {page + 1} / {Math.max(1, totalPages)}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
            className="px-3 h-8 rounded-lg bg-foreground/5 disabled:opacity-30 font-semibold">→</button>
        </div>
      </div>
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-foreground/5">
                <th className="text-left p-3 text-muted-foreground font-semibold">User</th>
                <th className="text-left p-3 text-muted-foreground font-semibold">Username</th>
                <th className="text-right p-3 text-muted-foreground font-semibold">ZappCoins</th>
                <th className="text-left p-3 text-muted-foreground font-semibold">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/5">
              {profiles.map((p: any) => (
                <tr key={p.id}>
                  <td className="p-3">{p.full_name || "—"}</td>
                  <td className="p-3 text-muted-foreground">@{p.username || "—"}</td>
                  <td className="p-3 text-right font-bold text-accent">{p.coin_balance}</td>
                  <td className="p-3 text-muted-foreground text-xs">{new Date(p.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
