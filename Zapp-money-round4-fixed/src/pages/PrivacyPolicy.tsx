import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pb-24 px-5 pt-12">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground mb-6">
        <ArrowLeft size={18} /> <span className="text-sm font-semibold">Back</span>
      </button>
      <h1 className="text-xl font-bold tracking-tight mb-6">Privacy Policy</h1>
      <div className="prose prose-sm prose-invert max-w-none space-y-4 text-sm text-muted-foreground leading-relaxed">
        <p className="text-foreground font-semibold">Last updated: 5 April 2026</p>

        <h2 className="text-foreground text-base font-bold mt-6">1. Introduction</h2>
        <p>Zapp (Pty) Ltd ("Zapp", "we", "us") is committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, store, and share your information when you use the Zapp mobile application ("App"). This policy is compliant with the Protection of Personal Information Act (POPIA) of South Africa.</p>

        <h2 className="text-foreground text-base font-bold mt-6">2. Information We Collect</h2>
        <p><strong className="text-foreground">Account Information:</strong> Full name, email address, phone number, username, and password when you register.</p>
        <p><strong className="text-foreground">Financial Information:</strong> Wallet balances, transaction history, ZappCoin balances, transfer records, and payment request details. We do not store bank card numbers directly.</p>
        <p><strong className="text-foreground">Usage Data:</strong> App interactions, feature usage patterns, device information, IP address, and session data for analytics and security purposes.</p>
        <p><strong className="text-foreground">Verification Data:</strong> Identity documents or additional information if required for regulatory compliance (KYC/AML).</p>

        <h2 className="text-foreground text-base font-bold mt-6">3. How We Use Your Information</h2>
        <p>We use your personal information to: provide and maintain the App; process transactions and transfers; prevent fraud and ensure security; comply with legal obligations; send notifications about your account; improve our services; and provide customer support.</p>

        <h2 className="text-foreground text-base font-bold mt-6">4. Data Storage & Security</h2>
        <p>Your data is stored securely using industry-standard encryption. We use Supabase infrastructure with Row-Level Security (RLS) policies to ensure data isolation between users. All financial operations are processed atomically to prevent data inconsistency. We implement two-factor authentication (2FA) as an additional security layer.</p>

        <h2 className="text-foreground text-base font-bold mt-6">5. Data Sharing</h2>
        <p>We do not sell your personal information. We may share data with: payment processors to facilitate transactions; regulatory authorities when required by law; service providers who assist in operating the App (under strict confidentiality agreements); and law enforcement when legally compelled.</p>

        <h2 className="text-foreground text-base font-bold mt-6">6. Your Rights (POPIA)</h2>
        <p>Under POPIA, you have the right to: access your personal information; correct inaccurate information; request deletion of your data (subject to legal retention requirements); object to processing of your data; withdraw consent; and lodge a complaint with the Information Regulator.</p>

        <h2 className="text-foreground text-base font-bold mt-6">7. Cookies & Analytics</h2>
        <p>We may use local storage and analytics tools to improve the App experience. These do not track you across other apps or websites.</p>

        <h2 className="text-foreground text-base font-bold mt-6">8. Data Retention</h2>
        <p>We retain your personal information for as long as your account is active or as needed to provide services. Financial records are retained for a minimum of 5 years as required by South African financial regulations (FICA). You may request account deletion, but certain records will be retained as legally required.</p>

        <h2 className="text-foreground text-base font-bold mt-6">9. Children's Privacy</h2>
        <p>Zapp is not intended for users under 18 years of age. We do not knowingly collect personal information from minors. If we become aware of such collection, we will delete the information immediately.</p>

        <h2 className="text-foreground text-base font-bold mt-6">10. International Transfers</h2>
        <p>When you use international transfer features, your information may be processed in countries outside South Africa to facilitate the transfer. We ensure adequate data protection safeguards are in place for all cross-border data flows.</p>

        <h2 className="text-foreground text-base font-bold mt-6">11. Changes to This Policy</h2>
        <p>We may update this Privacy Policy periodically. We will notify you of significant changes through the App. Your continued use constitutes acceptance of the revised policy.</p>

        <h2 className="text-foreground text-base font-bold mt-6">12. Contact Us</h2>
        <p>For privacy-related enquiries or to exercise your POPIA rights, contact our Information Officer at <span className="text-primary font-semibold">privacy@zapp.co.za</span>.</p>
      </div>
    </div>
  );
}
