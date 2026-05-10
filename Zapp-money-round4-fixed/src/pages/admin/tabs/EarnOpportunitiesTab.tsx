/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { ToggleLeft, ToggleRight, Plus } from "lucide-react";
import { useAdminEarnOpportunities } from "@/lib/hooks/useAdmin";
import ZappButton from "@/components/ZappButton";
import { toast } from "sonner";

const CATEGORIES = ["survey", "offerwall", "micro_task", "referral", "daily_reward", "streak", "bonus", "ad_reward", "promo", "admin"];

export default function EarnOpportunitiesTab() {
  const { opportunities, toggleStatus, addOpportunity } = useAdminEarnOpportunities();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: "", category: "survey", coin_reward: 50, provider: "internal", estimated_minutes: 5, description: "", availability_type: "once" });

  const handleAdd = async () => {
    if (!form.title) return;
    try {
      await addOpportunity({ ...form, coin_reward: Number(form.coin_reward), estimated_minutes: Number(form.estimated_minutes) });
      setForm({ title: "", category: "survey", coin_reward: 50, provider: "internal", estimated_minutes: 5, description: "", availability_type: "once" });
      setShowAdd(false);
      toast.success("Earn opportunity added");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const inputClass = "w-full h-10 bg-foreground/5 rounded-lg px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none";

  return (
    <div className="space-y-3">
      <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-2 text-sm font-semibold text-primary">
        <Plus size={16} /> Add Opportunity
      </button>

      {showAdd && (
        <div className="glass-card rounded-2xl p-4 space-y-3">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" className={inputClass} />
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description (optional)" className={inputClass} />
          <div className="grid grid-cols-2 gap-3">
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputClass}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
            </select>
            <select value={form.availability_type} onChange={(e) => setForm({ ...form, availability_type: e.target.value })} className={inputClass}>
              <option value="once">Once</option>
              <option value="daily">Daily</option>
              <option value="unlimited">Unlimited</option>
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <input type="number" value={form.coin_reward} onChange={(e) => setForm({ ...form, coin_reward: Number(e.target.value) })} placeholder="ZC Reward" className={inputClass} />
            <input type="number" value={form.estimated_minutes} onChange={(e) => setForm({ ...form, estimated_minutes: Number(e.target.value) })} placeholder="Est. min" className={inputClass} />
            <input value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} placeholder="Provider" className={inputClass} />
          </div>
          <ZappButton onClick={handleAdd}>Add Opportunity</ZappButton>
        </div>
      )}

      {opportunities.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">No earn opportunities yet</p>
      )}

      {opportunities.map((o: any) => (
        <div key={o.id} className="glass-card rounded-2xl p-4 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sm truncate">{o.title}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="capitalize">{o.category.replace("_", " ")}</span>
              <span>·</span>
              <span>{o.coin_reward} ZC</span>
              <span>·</span>
              <span>{o.provider}</span>
              <span>·</span>
              <span className="capitalize">{o.availability_type}</span>
            </div>
          </div>
          <button onClick={() => toggleStatus({ id: o.id, status: o.status })}>
            {o.status === "active" ? (
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
