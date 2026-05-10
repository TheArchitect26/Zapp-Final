/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { ToggleLeft, ToggleRight, Plus } from "lucide-react";
import { useAdminCurrencies } from "@/lib/hooks/useAdmin";
import ZappButton from "@/components/ZappButton";
import { toast } from "sonner";

export default function CurrenciesTab() {
  const { currencies, toggleStatus, addCurrency, updateRate } = useAdminCurrencies();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", symbol: "", country: "", zc_rate: 100 });
  const [editingRate, setEditingRate] = useState<string | null>(null);
  const [rateValue, setRateValue] = useState("");

  const inputClass = "w-full h-10 bg-foreground/5 rounded-lg px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none";

  const handleAdd = async () => {
    if (!form.code || !form.name) return;
    try {
      await addCurrency({ ...form, zc_rate: Number(form.zc_rate) });
      setForm({ code: "", name: "", symbol: "", country: "", zc_rate: 100 });
      setShowAdd(false);
      toast.success("Currency added");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleSaveRate = (id: string) => {
    const rate = Number(rateValue);
    if (rate <= 0) return;
    updateRate({ id, zc_rate: rate });
    setEditingRate(null);
    toast.success("Rate updated");
  };

  return (
    <div className="space-y-3">
      <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-2 text-sm font-semibold text-primary">
        <Plus size={16} /> Add Currency
      </button>

      {showAdd && (
        <div className="glass-card rounded-2xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="Code (e.g. USD)" className={inputClass} maxLength={3} />
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" className={inputClass} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <input value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })} placeholder="Symbol ($)" className={inputClass} maxLength={3} />
            <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="Country" className={inputClass} />
            <input type="number" value={form.zc_rate} onChange={(e) => setForm({ ...form, zc_rate: Number(e.target.value) })} placeholder="ZC Rate" className={inputClass} />
          </div>
          <ZappButton onClick={handleAdd}>Add Currency</ZappButton>
        </div>
      )}

      {currencies.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">No currencies configured</p>
      )}

      {currencies.map((c: any) => (
        <div key={c.id} className="glass-card rounded-2xl p-4 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">{c.symbol} {c.code}</span>
              <span className="text-xs text-muted-foreground">— {c.name}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              {c.country && <span>{c.country}</span>}
              <span>·</span>
              {editingRate === c.id ? (
                <span className="flex items-center gap-1">
                  <input
                    type="number"
                    value={rateValue}
                    onChange={(e) => setRateValue(e.target.value)}
                    className="w-20 h-6 bg-foreground/10 rounded px-2 text-xs text-foreground"
                    autoFocus
                  />
                  <button onClick={() => handleSaveRate(c.id)} className="text-accent font-semibold">Save</button>
                  <button onClick={() => setEditingRate(null)} className="text-muted-foreground">✕</button>
                </span>
              ) : (
                <button
                  onClick={() => { setEditingRate(c.id); setRateValue(String(c.zc_rate)); }}
                  className="hover:text-foreground transition-colors"
                >
                  1 {c.code} = {c.zc_rate} ZC
                </button>
              )}
            </div>
          </div>
          <button onClick={() => toggleStatus({ id: c.id, status: c.status })}>
            {c.status === "active" ? (
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
