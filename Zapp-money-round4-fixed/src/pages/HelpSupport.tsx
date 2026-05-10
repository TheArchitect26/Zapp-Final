import { useState } from "react";
import { ArrowLeft, ChevronDown, MessageCircle, Mail, Phone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

const faqs = [
  {
    q: "How do I top up my wallet?",
    a: "Go to the Home screen and tap 'Top Up'. Enter the amount you'd like to add. Once payment gateway integration is live, you'll be able to pay via card, EFT, or supported local methods."
  },
  {
    q: "What is ZappCoin (ZC)?",
    a: "ZappCoin is Zapp's internal utility token. You earn ZC by completing surveys, tasks, and referrals. ZC can be converted to wallet balance (R1 = 100 ZC) or used as a bridge currency for international transfers."
  },
  {
    q: "How do international transfers work?",
    a: "Select a transfer corridor, enter the recipient's details and amount. Zapp converts your balance to ZappCoin internally, then converts to the destination currency. You'll see exact fees and the recipient amount before confirming."
  },
  {
    q: "Are my funds safe?",
    a: "Yes. All transactions are processed atomically on our servers with full ledger tracking. We use industry-standard encryption and Row-Level Security to protect your data. You can also enable Two-Factor Authentication for extra security."
  },
  {
    q: "How do I enable Two-Factor Authentication?",
    a: "Go to Settings → Security → Two-Factor Auth. You'll be guided through setting up TOTP (Time-based One-Time Password) using an authenticator app like Google Authenticator or Authy."
  },
  {
    q: "How do I buy vouchers?",
    a: "Navigate to the Vouchers page from the bottom menu. Browse by category (Gaming, Betting, Shopping, Entertainment), select a brand and value, then confirm your purchase. The cost is deducted from your wallet."
  },
  {
    q: "Can I send money to another Zapp user?",
    a: "Yes! From the Home screen, tap 'Send' and enter the recipient's @username and amount. The transfer is instant and both parties receive a notification."
  },
  {
    q: "What happens if a transfer fails?",
    a: "Failed transfers do not deduct from your balance. Our atomic transaction system ensures that partial updates never occur. If you experience issues, please contact support."
  },
  {
    q: "How do I earn ZappCoin?",
    a: "Visit the Earn page to find available surveys, tasks, and offers. Complete them to receive ZC rewards. You can also earn through referrals — share your referral code with friends!"
  },
  {
    q: "How do I convert ZappCoin to Rand?",
    a: "On the Earn page, use the 'Convert ZC' option. Enter the number of ZappCoins (minimum 100 ZC). The equivalent Rand value will be added to your wallet instantly."
  },
];

export default function HelpSupport() {
  const navigate = useNavigate();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="min-h-screen pb-24 px-5 pt-12">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground mb-6">
        <ArrowLeft size={18} /> <span className="text-sm font-semibold">Back</span>
      </button>
      <h1 className="text-xl font-bold tracking-tight mb-6">Help & Support</h1>

      {/* Contact Cards */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <a href="mailto:support@zapp.co.za" className="glass-card rounded-2xl p-4 flex flex-col items-center gap-2 text-center">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <Mail size={16} className="text-primary" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Email</span>
        </a>
        <a href="https://wa.me/27600000000" target="_blank" rel="noopener noreferrer" className="glass-card rounded-2xl p-4 flex flex-col items-center gap-2 text-center">
          <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
            <MessageCircle size={16} className="text-accent" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">WhatsApp</span>
        </a>
        <a href="tel:+27800000000" className="glass-card rounded-2xl p-4 flex flex-col items-center gap-2 text-center">
          <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center">
            <Phone size={16} className="text-secondary" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Call</span>
        </a>
      </div>

      {/* FAQ */}
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Frequently Asked Questions</h2>
      <div className="space-y-2">
        {faqs.map((faq, i) => (
          <div key={i} className="glass-card rounded-2xl overflow-hidden">
            <button
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="w-full px-5 py-4 flex items-center justify-between text-left"
            >
              <span className="text-sm font-semibold pr-4">{faq.q}</span>
              <ChevronDown
                size={16}
                className={`text-muted-foreground shrink-0 transition-transform ${openIndex === i ? "rotate-180" : ""}`}
              />
            </button>
            <AnimatePresence>
              {openIndex === i && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <p className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      <p className="text-center text-[10px] text-muted-foreground/40 mt-8">
        Support hours: Mon–Fri 8:00 – 18:00 SAST
      </p>
    </div>
  );
}
