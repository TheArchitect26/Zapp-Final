import { useState } from "react";
import { motion } from "framer-motion";
import { ShoppingCart, Gamepad2, Tv, Check, Dices, Gift } from "lucide-react";
import { useWallet } from "@/lib/store";
import { useVoucherBrands, useVoucherProducts } from "@/lib/hooks/useVoucherCatalog";
import BottomSheet from "@/components/BottomSheet";
import ZappButton from "@/components/ZappButton";
import { toast } from "sonner";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const categoryIcons: Record<string, any> = {
  shopping: ShoppingCart,
  gaming: Gamepad2,
  entertainment: Tv,
  betting: Dices,
};

const categoryLabels: Record<string, string> = {
  shopping: "Shopping",
  gaming: "Gaming",
  entertainment: "Entertainment",
  betting: "Betting",
};

const categoryOrder = ["shopping", "gaming", "entertainment", "betting"];

export default function Vouchers() {
  const wallet = useWallet();
  const { data: brands = [], isLoading } = useVoucherBrands();
  const [activeCategory, setActiveCategory] = useState("shopping");
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [selectedValue, setSelectedValue] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const { data: products = [] } = useVoucherProducts(selectedBrandId);

  const selectedBrand = brands.find((b) => b.id === selectedBrandId);
  const filtered = brands.filter((b) => b.category === activeCategory);
  const categories = categoryOrder.filter((c) => brands.some((b) => b.category === c));

  const handleBuy = async () => {
    if (!selectedBrand || !amount) return;
    setLoading(true);
    try {
      await wallet.addTransaction({
        type: "voucher",
        description: `${selectedBrand.name} R${selectedValue} Voucher`,
        amount,
        meta: { brand: selectedBrand.name, value: String(selectedValue) },
      });
      setSuccess(true);
      toast.success("Voucher purchased!");
    } catch (err) {
      toast.error(err?.message || "Purchase failed");
    } finally {
      setLoading(false);
    }
  };

  const closeSheet = () => {
    setSelectedBrandId(null);
    setAmount(0);
    setSelectedValue(0);
    setSuccess(false);
  };

  return (
    <div className="min-h-screen pb-24 px-5 pt-12">
      <h1 className="text-xl font-bold tracking-tight mb-6">Vouchers & Gift Cards</h1>

      {/* Category tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar">
        {categories.map((cat) => {
          const Icon = categoryIcons[cat] || Gift;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex items-center gap-1.5 px-4 h-10 rounded-lg font-semibold text-sm whitespace-nowrap transition-all ${
                activeCategory === cat
                  ? "bg-primary text-primary-foreground"
                  : "bg-foreground/5 text-muted-foreground"
              }`}
            >
              <Icon size={14} />
              {categoryLabels[cat] || cat}
            </button>
          );
        })}
      </div>

      {/* Brand grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass-card rounded-2xl p-5 animate-pulse h-28" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Gift size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No vouchers in this category yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((v, i) => (
            <motion.button
              key={v.id}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: i * 0.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setSelectedBrandId(v.id);
                setAmount(0);
                setSelectedValue(0);
              }}
              className="glass-card rounded-2xl p-5 text-left"
            >
              <div
                className={`w-10 h-10 rounded-xl ${v.color_class} flex items-center justify-center mb-3 font-bold text-sm`}
              >
                {v.name[0]}
              </div>
              <p className="font-bold text-sm">{v.name}</p>
              <p className="text-xs text-muted-foreground capitalize mt-0.5">{v.category}</p>
            </motion.button>
          ))}
        </div>
      )}

      {/* Purchase sheet */}
      <BottomSheet open={!!selectedBrandId} onClose={closeSheet} title={selectedBrand?.name || ""}>
        {success ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center py-8"
          >
            <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-4">
              <Check size={32} className="text-accent" />
            </div>
            <h3 className="text-lg font-bold mb-1">Voucher Purchased!</h3>
            <p className="text-sm text-muted-foreground">
              R{selectedValue} {selectedBrand?.name} voucher
            </p>
            <ZappButton variant="ghost" className="mt-6" onClick={closeSheet}>
              Done
            </ZappButton>
          </motion.div>
        ) : (
          <div className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">Select a value</p>
            <div className="grid grid-cols-3 gap-2">
              {products.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setAmount(p.price);
                    setSelectedValue(p.value);
                  }}
                  className={`h-12 rounded-lg font-bold text-sm transition-all ${
                    amount === p.price
                      ? "bg-primary text-primary-foreground"
                      : "bg-foreground/5 text-foreground"
                  }`}
                >
                  R{p.value}
                </button>
              ))}
            </div>
            {amount > 0 && (
              <div className="bg-foreground/5 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Voucher value</span>
                  <span>R{selectedValue}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>You pay</span>
                  <span>R{amount}</span>
                </div>
              </div>
            )}
            <ZappButton onClick={handleBuy} loading={loading} disabled={!amount}>
              Buy R{amount || "0"} Voucher
            </ZappButton>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
