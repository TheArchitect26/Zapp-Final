import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ShieldCheck, Upload, Loader2, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import ZappButton from "@/components/ZappButton";
import { toast } from "sonner";

const API = import.meta.env.VITE_API_BASE_URL || "";

type Step = "form" | "upload" | "pending" | "done";

export default function KYCVerification() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("form");
  const [idNumber, setIdNumber] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [finalStatus, setFinalStatus] = useState<"verified" | "failed" | null>(null);

  const handleSubmitDetails = async () => {
    if (!/^\d{13}$/.test(idNumber)) { toast.error("Enter a valid 13-digit SA ID number"); return; }
    if (!firstName.trim() || !lastName.trim()) { toast.error("First and last name required"); return; }
    setSubmitting(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch(`${API}/api/v1/kyc/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ id_number: idNumber, first_name: firstName, last_name: lastName }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Submission failed");
      setStep("upload");
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setSubmitting(false); }
  };

  const handleUpload = async () => {
    if (!idFile || !selfieFile) { toast.error("Please select both files"); return; }
    setUploading(true);
    try {
      const uid = user!.id;
      await supabase.storage.from("kyc-documents").upload(`${uid}/id_document`, idFile, { upsert: true });
      await supabase.storage.from("kyc-documents").upload(`${uid}/selfie`, selfieFile, { upsert: true });
      setStep("pending");
    } catch (err) {
      toast.error("Upload failed — please try again");
    } finally { setUploading(false); }
  };

  // Poll kyc_submissions for result
  useEffect(() => {
    if (step !== "pending") return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("kyc_submissions").select("status")
        .eq("user_id", user!.id).order("created_at", { ascending: false }).limit(1).single();
      if (data?.status === "verified") { setFinalStatus("verified"); setStep("done"); clearInterval(interval); }
      else if (data?.status === "failed") { setFinalStatus("failed"); setStep("done"); clearInterval(interval); }
    }, 5000);
    // Stop after 10 minutes
    const timeout = setTimeout(() => clearInterval(interval), 600_000);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [step, user]);

  return (
    <div className="min-h-screen pb-24 px-5 pt-12">
      <button onClick={() => navigate(-1)} className="text-sm text-muted-foreground mb-6 block">← Back</button>
      <h1 className="text-xl font-bold tracking-tight mb-6">Verify Your Identity</h1>

      {step === "form" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <p className="text-sm text-muted-foreground">Enter your details exactly as they appear on your South African ID.</p>
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name"
            className="w-full h-14 bg-foreground/5 rounded-lg px-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name"
            className="w-full h-14 bg-foreground/5 rounded-lg px-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
          <input value={idNumber} onChange={(e) => setIdNumber(e.target.value.replace(/\D/g, ""))} placeholder="SA ID number (13 digits)"
            maxLength={13} inputMode="numeric"
            className="w-full h-14 bg-foreground/5 rounded-lg px-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
          <ZappButton onClick={handleSubmitDetails} loading={submitting} disabled={!idNumber || !firstName || !lastName}>
            Continue
          </ZappButton>
        </motion.div>
      )}

      {step === "upload" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <p className="text-sm text-muted-foreground">Upload a clear photo of your ID document and a selfie.</p>
          <label className="block">
            <span className="text-xs text-muted-foreground uppercase tracking-widest">ID Document</span>
            <div className="mt-1 h-14 bg-foreground/5 rounded-lg flex items-center px-4 gap-3 cursor-pointer">
              <Upload size={16} className="text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{idFile ? idFile.name : "Choose file…"}</span>
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => setIdFile(e.target.files?.[0] || null)} />
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground uppercase tracking-widest">Selfie</span>
            <div className="mt-1 h-14 bg-foreground/5 rounded-lg flex items-center px-4 gap-3 cursor-pointer">
              <Upload size={16} className="text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{selfieFile ? selfieFile.name : "Choose file…"}</span>
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => setSelfieFile(e.target.files?.[0] || null)} />
          </label>
          <ZappButton onClick={handleUpload} loading={uploading} disabled={!idFile || !selfieFile}>
            Submit Documents
          </ZappButton>
        </motion.div>
      )}

      {step === "pending" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-4 pt-12">
          <Loader2 size={48} className="animate-spin text-primary mx-auto" />
          <p className="font-bold text-lg">Verification in progress</p>
          <p className="text-sm text-muted-foreground">Usually under 5 minutes. We'll notify you when it's done.</p>
        </motion.div>
      )}

      {step === "done" && (
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center space-y-4 pt-12">
          {finalStatus === "verified"
            ? <><CheckCircle size={64} className="text-accent mx-auto" /><p className="font-extrabold text-2xl">Identity Verified!</p><p className="text-sm text-muted-foreground">You can now make withdrawals.</p></>
            : <><XCircle size={64} className="text-destructive mx-auto" /><p className="font-extrabold text-2xl">Verification Failed</p><p className="text-sm text-muted-foreground">Please check your details and try again.</p></>
          }
          <ZappButton onClick={() => navigate("/")}>Back to Home</ZappButton>
        </motion.div>
      )}
    </div>
  );
}
