/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { ToggleLeft, ToggleRight, Plus } from "lucide-react";
import { useAdminCorridors, useAdminCurrencies } from "@/lib/hooks/useAdmin";
import ZappButton from "@/components/ZappButton";
import { toast } from "sonner";

export default function CorridorsTab() {
  const { corridors, toggleStatus, addCorridor } = useAdminCorridors();
  const { currencies } = useAdminCurrencies();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    source_currency_id: "",
    destination_currency_id: "",
    fee_percentage: 2.5,
    flat_fee: 0,
    min_amount: 10,
    max_amount: 50000,
  });

  const inputClass = "w-full h-10 bg-foreground/5 rounded-lg px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none";

  const handleAdd = async () => {
    if (!form.source_currency_id || !form.destination_currency_id) {
      toast.error("Select both currencies");
      return;
    }
    try {
      await addCorridor({
        ...form,
        fee_percentage: Number(form.fee_percentage),
        flat_fee: Number(form.flat_fee),
        min_amount: Number(form.min_amount),
        max_amount: Number(form.max_amount),
      });
      setForm({ source_currency_id: "", destination_currency_id: "", fee_percentage: 2.5, flat_fee: 0, min_amount: 10, max_amount: 50000 });
      setShowAdd(false);
      toast.success("Corridor added");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="space-y-3">
      <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-2 text-sm font-semibold text-primary">
        <Plus size={16} /> Add Corridor
      </button>

      {showAdd && (
        <div className="glass-card rounded-2xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <select value={form.source_currency_id} onChange={(e) => setForm({ ...form, source_currency_id: e.target.value })} className={inputClass}>
              <option value="">Source currency</option>
              {currencies.map((c: any) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
            </select>
            <select value={form.destination_currency_id} onChange={(e) => setForm({ ...form, destination_currency_id: e.target.value })} className={inputClass}>
              <option value="">Destination currency</option>
              {currencies.map((c: any) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input type="number" value={form.fee_percentage} onChange={(e) => setForm({ ...form, fee_percentage: Number(e.target.value) })} placeholder="Fee %" className={inputClass} step="0.1" />
            <input type="number" value={form.flat_fee} onChange={(e) => setForm({ ...form, flat_fee: Number(e.target.value) })} placeholder="Flat fee" className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input type="number" value={form.min_amount} onChange={(e) => setForm({ ...form, min_amount: Number(e.target.value) })} placeholder="Min amount" className={inputClass} />
            <input type="number" value={form.max_amount} onChange={(e) => setForm({ ...form, max_amount: Number(e.target.value) })} placeholder="Max amount" className={inputClass} />
          </div>
          <ZappButton onClick={handleAdd}>Add Corridor</ZappButton>
        </div>
      )}

      {corridors.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">No transfer corridors configured</p>
      )}

      {corridors.map((c: any) => (
        <div key={c.id} className="glass-card rounded-2xl p-4 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sm">
              {c.source?.code || "?"} → {c.destination?.code || "?"}
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Fee: {c.fee_percentage}%{c.flat_fee > 0 ? ` + ${c.flat_fee}` : ""}</span>
              <span>·</span>
              <span>Range: {c.min_amount}–{c.max_amount}</span>
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
