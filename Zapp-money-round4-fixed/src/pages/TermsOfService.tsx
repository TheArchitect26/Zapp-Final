import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function TermsOfService() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pb-24 px-5 pt-12">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground mb-6">
        <ArrowLeft size={18} /> <span className="text-sm font-semibold">Back</span>
      </button>
      <h1 className="text-xl font-bold tracking-tight mb-6">Terms of Service</h1>
      <div className="prose prose-sm prose-invert max-w-none space-y-4 text-sm text-muted-foreground leading-relaxed">
        <p className="text-foreground font-semibold">Last updated: 5 April 2026</p>

        <h2 className="text-foreground text-base font-bold mt-6">1. Acceptance of Terms</h2>
        <p>By accessing or using the Zapp mobile application ("App"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree, do not use the App. These Terms constitute a legally binding agreement between you and Zapp (Pty) Ltd ("Zapp", "we", "us", "our").</p>

        <h2 className="text-foreground text-base font-bold mt-6">2. Eligibility</h2>
        <p>You must be at least 18 years old and a resident of a supported country to use Zapp. By registering, you confirm that the information you provide is accurate and complete. We reserve the right to suspend accounts that violate eligibility requirements.</p>

        <h2 className="text-foreground text-base font-bold mt-6">3. Account Registration</h2>
        <p>You are responsible for maintaining the confidentiality of your login credentials. You agree to notify us immediately of any unauthorized access. Zapp is not liable for losses arising from unauthorized use of your account.</p>

        <h2 className="text-foreground text-base font-bold mt-6">4. ZappCoin (ZC)</h2>
        <p>ZappCoin is Zapp's internal utility token used for rewards, transfers, and conversions within the App. ZC is not a cryptocurrency, security, or investment product. ZC has no guaranteed external market value and cannot be redeemed for cash outside the App except through officially supported conversion features. Zapp reserves the right to adjust ZC conversion rates at any time.</p>

        <h2 className="text-foreground text-base font-bold mt-6">5. Wallet & Transactions</h2>
        <p>Your Zapp wallet holds a balance in South African Rand (ZAR) or other supported currencies. All transactions (purchases, transfers, top-ups) are final once confirmed. Zapp uses atomic server-side processing to ensure transaction integrity. You acknowledge that wallet balances reflect the state of the ledger and are not held in a traditional bank account unless explicitly stated.</p>

        <h2 className="text-foreground text-base font-bold mt-6">6. International Transfers</h2>
        <p>International transfers are facilitated using ZappCoin as a bridge asset. Exchange rates, fees, and supported corridors are displayed before confirmation and may change without prior notice. Transfer limits and supported countries are determined by Zapp and may be updated at any time. Zapp does not guarantee delivery times for cross-border transfers.</p>

        <h2 className="text-foreground text-base font-bold mt-6">7. Earn & Rewards</h2>
        <p>Rewards earned through surveys, tasks, referrals, and other activities are credited in ZC. Zapp reserves the right to modify, suspend, or discontinue any earning opportunity at any time. Fraudulent or duplicate reward claims will result in account suspension and forfeiture of rewards.</p>

        <h2 className="text-foreground text-base font-bold mt-6">8. Vouchers & Purchases</h2>
        <p>Vouchers purchased through the App are subject to the terms and conditions of the respective voucher provider. Zapp acts as a reseller and is not responsible for voucher redemption issues with third-party merchants. All voucher purchases are non-refundable.</p>

        <h2 className="text-foreground text-base font-bold mt-6">9. Prohibited Conduct</h2>
        <p>You may not: use the App for illegal activities including money laundering or fraud; create multiple accounts; exploit bugs or system vulnerabilities; reverse-engineer the App; use automated systems to interact with the App; or transfer your account to another person.</p>

        <h2 className="text-foreground text-base font-bold mt-6">10. Limitation of Liability</h2>
        <p>Zapp is provided "as is" without warranties of any kind. To the maximum extent permitted by law, Zapp shall not be liable for indirect, incidental, or consequential damages. Our total liability shall not exceed the balance in your wallet at the time of the claim.</p>

        <h2 className="text-foreground text-base font-bold mt-6">11. Termination</h2>
        <p>Zapp may suspend or terminate your account at any time for violation of these Terms or for any reason deemed necessary to protect the platform. Upon termination, remaining wallet balances may be refunded subject to applicable laws and deductions for any outstanding obligations.</p>

        <h2 className="text-foreground text-base font-bold mt-6">12. Governing Law</h2>
        <p>These Terms are governed by the laws of the Republic of South Africa. Any disputes shall be resolved in the courts of Johannesburg, Gauteng.</p>

        <h2 className="text-foreground text-base font-bold mt-6">13. Changes to Terms</h2>
        <p>We may update these Terms at any time. Continued use of the App after changes constitutes acceptance of the updated Terms. We will notify users of material changes via the App or email.</p>

        <h2 className="text-foreground text-base font-bold mt-6">14. Contact</h2>
        <p>For questions about these Terms, contact us at <span className="text-primary font-semibold">legal@zapp.co.za</span>.</p>
      </div>
    </div>
  );
}
