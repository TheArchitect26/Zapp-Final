import { useState, useRef } from "react";
import { ChevronRight, Copy, Check, Settings, ScanLine, ShieldCheck, ShieldAlert, Upload, Loader2, FileText } from "lucide-react";
import { motion } from "framer-motion";
import { useProfile } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import QRCodeDisplay from "@/components/QRCodeDisplay";
import QRScanner from "@/components/QRScanner";
import SendMoneySheet from "@/components/SendMoneySheet";
import ZappButton from "@/components/ZappButton";

export default function Profile() {
  const profile = useProfile();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showQR, setShowQR] = useState(false);
  const [showKYC, setShowKYC] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [sendToUser, setSendToUser] = useState("");
  const [copied, setCopied] = useState(false);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);

  const kycStatus = profile?.kyc_status || "unverified";
  const initial = (profile?.full_name?.[0] || profile?.username?.[0] || "Z").toUpperCase();

  const copyReferral = () => {
    if (profile?.referral_code) {
      navigator.clipboard.writeText(profile.referral_code);
      setCopied(true);
      toast.success("Referral code copied!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleQRScan = (username: string) => {
    setScannerOpen(false);
    setSendToUser(username);
    setSendOpen(true);
  };

  const submitKYC = useMutation({
    mutationFn: async () => {
      if (!idFile || !user) throw new Error("Please upload your ID document");

      const idPath = `${user.id}/id-document-${Date.now()}.${idFile.name.split(".").pop()}`;
      const { error: idErr } = await supabase.storage.from("kyc-documents").upload(idPath, idFile);
      if (idErr) throw idErr;

      if (selfieFile) {
        const selfiePath = `${user.id}/selfie-${Date.now()}.${selfieFile.name.split(".").pop()}`;
        const { error: selfieErr } = await supabase.storage.from("kyc-documents").upload(selfiePath, selfieFile);
        if (selfieErr) throw selfieErr;
      }

      const { error } = await supabase
        .from("profiles")
        .update({ kyc_status: "pending" })
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      setIdFile(null);
      setSelfieFile(null);
      setShowKYC(false);
      toast.success("KYC documents submitted for review!");
    },
    onError: (err: unknown) => {
      toast.error((err as Error).message || "Upload failed");
    },
  });

  const kycBanner = () => {
    if (kycStatus === "verified") {
      return (
        <div className="glass-card rounded-2xl p-4 mb-4 flex items-center gap-3 border border-accent/20">
          <ShieldCheck size={20} className="text-accent" />
          <div>
            <p className="font-bold text-sm text-accent">Identity Verified</p>
            <p className="text-xs text-muted-foreground">Your account is fully verified</p>
          </div>
        </div>
      );
    }
    if (kycStatus === "pending") {
      return (
        <div className="glass-card rounded-2xl p-4 mb-4 flex items-center gap-3 border border-yellow-500/30">
          <Loader2 size={20} className="text-yellow-400 animate-spin" />
          <div>
            <p className="font-bold text-sm">Verification in progress</p>
            <p className="text-xs text-muted-foreground">We're reviewing your documents (usually 24h)</p>
          </div>
        </div>
      );
    }
    return (
      <button onClick={() => setShowKYC(!showKYC)}
        className="w-full glass-card rounded-2xl p-4 mb-4 flex items-center gap-3 text-left border border-primary/20">
        <ShieldAlert size={20} className="text-primary" />
        <div className="flex-1">
          <p className="font-bold text-sm">{kycStatus === "rejected" ? "Verification rejected" : "Verify your identity"}</p>
          <p className="text-xs text-muted-foreground">
            {kycStatus === "rejected" ? "Please resubmit your documents" : "Required for withdrawals"}
          </p>
        </div>
        <ChevronRight size={16} className={`text-muted-foreground transition-transform ${showKYC ? "rotate-90" : ""}`} />
      </button>
    );
  };

  return (
    <div className="min-h-screen pb-24 px-5 pt-12">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold tracking-tight">profile</h1>
        <button onClick={() => navigate("/settings")} className="p-2 rounded-lg bg-foreground/5">
          <Settings size={18} className="text-muted-foreground" />
        </button>
      </div>

      {/* Profile Card */}
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="glass-card rounded-2xl p-6 flex items-center gap-4 mb-4">
        <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
          <span className="text-xl font-bold text-primary">{initial}</span>
        </div>
        <div className="flex-1">
          <p className="font-bold">{profile?.full_name || "Set your name"}</p>
          <p className="text-sm text-muted-foreground">@{profile?.username || "username"}</p>
          <p className="text-xs text-muted-foreground">{profile?.phone_number || "Add phone number"}</p>
        </div>
        <button onClick={() => navigate("/settings")} className="text-xs text-primary font-semibold">Edit</button>
      </motion.div>

      {/* KYC Status / Verification */}
      {kycBanner()}
      {showKYC && (kycStatus === "unverified" || kycStatus === "rejected") && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
          className="glass-card rounded-2xl p-5 mb-4 space-y-4">
          <div>
            <p className="font-bold text-sm mb-1">Submit Verification Documents</p>
            <p className="text-xs text-muted-foreground">
              Upload a clear photo of your South African ID, passport, or driver's license. A selfie is optional but speeds up review.
            </p>
          </div>

          {/* ID Document Upload */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 block">
              ID Document *
            </label>
            <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden"
              onChange={(e) => setIdFile(e.target.files?.[0] || null)} />
            <button onClick={() => fileInputRef.current?.click()}
              className="w-full h-20 border-2 border-dashed border-foreground/10 rounded-xl flex flex-col items-center justify-center gap-1 hover:border-primary/30 transition-colors">
              {idFile ? (
                <>
                  <FileText size={20} className="text-accent" />
                  <span className="text-xs text-accent font-semibold">{idFile.name}</span>
                </>
              ) : (
                <>
                  <Upload size={20} className="text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Tap to upload ID</span>
                </>
              )}
            </button>
          </div>

          {/* Selfie Upload */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 block">
              Selfie (optional)
            </label>
            <input ref={selfieInputRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => setSelfieFile(e.target.files?.[0] || null)} />
            <button onClick={() => selfieInputRef.current?.click()}
              className="w-full h-20 border-2 border-dashed border-foreground/10 rounded-xl flex flex-col items-center justify-center gap-1 hover:border-primary/30 transition-colors">
              {selfieFile ? (
                <>
                  <FileText size={20} className="text-accent" />
                  <span className="text-xs text-accent font-semibold">{selfieFile.name}</span>
                </>
              ) : (
                <>
                  <Upload size={20} className="text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Tap to upload selfie</span>
                </>
              )}
            </button>
          </div>

          <ZappButton onClick={() => submitKYC.mutate()} loading={submitKYC.isPending} disabled={!idFile}>
            Submit for Verification
          </ZappButton>
        </motion.div>
      )}

      {/* Zapp Pay QR */}
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.05 }}
        className="mb-4">
        <button onClick={() => setShowQR(!showQR)}
          className="w-full glass-card rounded-2xl p-4 flex items-center justify-between text-left">
          <span className="text-sm font-semibold">My Zapp Pay QR</span>
          <ChevronRight size={16} className={`text-muted-foreground transition-transform ${showQR ? "rotate-90" : ""}`} />
        </button>
        {showQR && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="mt-2">
            <QRCodeDisplay />
          </motion.div>
        )}
      </motion.div>

      {/* Scan to Pay */}
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.08 }}>
        <button onClick={() => setScannerOpen(true)}
          className="w-full glass-card rounded-2xl p-4 flex items-center gap-3 mb-4 text-left">
          <ScanLine size={18} className="text-primary" />
          <span className="text-sm font-semibold flex-1">Scan to Pay</span>
          <ChevronRight size={16} className="text-muted-foreground" />
        </button>
      </motion.div>

      {/* Referral Code */}
      {profile?.referral_code && (
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1 }}
          className="glass-card rounded-2xl p-4 mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-0.5">referral code</p>
            <p className="font-mono-token font-bold text-sm text-primary">{profile.referral_code}</p>
          </div>
          <button onClick={copyReferral} className="p-2 rounded-lg bg-foreground/5 active:scale-95 transition-transform">
            {copied ? <Check size={16} className="text-accent" /> : <Copy size={16} className="text-muted-foreground" />}
          </button>
        </motion.div>
      )}

      <QRScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onScan={handleQRScan} />
      <SendMoneySheet open={sendOpen} onClose={() => { setSendOpen(false); setSendToUser(""); }} prefillUsername={sendToUser} />
    </div>
  );
}
