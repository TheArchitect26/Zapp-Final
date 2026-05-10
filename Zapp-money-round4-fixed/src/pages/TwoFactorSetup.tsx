import { useState, useEffect } from "react";
import { ArrowLeft, Shield, Copy, Check, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ZappButton from "@/components/ZappButton";
import { QRCodeSVG } from "qrcode.react";

type MFAStep = "loading" | "enroll" | "verify" | "enabled" | "already_enabled";

export default function TwoFactorSetup() {
  const navigate = useNavigate();
  const [step, setStep] = useState<MFAStep>("loading");
  const [qrUri, setQrUri] = useState("");
  const [secret, setSecret] = useState("");
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [unenrolling, setUnenrolling] = useState(false);

  useEffect(() => {
    checkExisting();
  }, []);

  const checkExisting = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      const factors = data.totp || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const verified = factors.find((f: any) => f.status === "verified");
      if (verified) {
        setFactorId(verified.id);
        setStep("already_enabled");
        return;
      }
      // Unenroll any unverified factors first
      for (const f of factors) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      await enrollNew();
    } catch (err) {
      toast.error("Failed to load 2FA status");
      console.error(err);
      setStep("enroll");
    }
  };

  const enrollNew = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Zapp Authenticator",
      });
      if (error) throw error;
      setQrUri(data.totp.uri);
      setSecret(data.totp.secret);
      setFactorId(data.id);
      setStep("enroll");
    } catch (err) {
      toast.error((err as Error).message || "Failed to start 2FA setup");
      setStep("enroll");
    }
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      toast.error("Enter a 6-digit code");
      return;
    }
    setVerifying(true);
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) throw challenge.error;

      const verify = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code,
      });
      if (verify.error) throw verify.error;

      toast.success("Two-Factor Authentication enabled!");
      setStep("enabled");
    } catch (err) {
      toast.error((err as Error).message || "Invalid code, try again");
    } finally {
      setVerifying(false);
    }
  };

  const handleDisable = async () => {
    setUnenrolling(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      toast.success("Two-Factor Authentication disabled");
      navigate(-1);
    } catch (err) {
      toast.error((err as Error).message || "Failed to disable 2FA");
    } finally {
      setUnenrolling(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen pb-24 px-5 pt-12">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground mb-6">
        <ArrowLeft size={18} /> <span className="text-sm font-semibold">Back</span>
      </button>
      <h1 className="text-xl font-bold tracking-tight mb-6">Two-Factor Authentication</h1>

      {step === "loading" && (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      )}

      {step === "already_enabled" && (
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-4">
            <Shield size={28} className="text-accent" />
          </div>
          <h3 className="text-lg font-bold mb-2">2FA is Active</h3>
          <p className="text-sm text-muted-foreground mb-8">
            Your account is protected with Two-Factor Authentication.
          </p>
          <ZappButton variant="ghost" onClick={handleDisable} loading={unenrolling}>
            Disable 2FA
          </ZappButton>
        </div>
      )}

      {step === "enabled" && (
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-4">
            <Check size={28} className="text-accent" />
          </div>
          <h3 className="text-lg font-bold mb-2">2FA Enabled Successfully!</h3>
          <p className="text-sm text-muted-foreground mb-8">
            Your account is now protected with an authenticator app.
          </p>
          <ZappButton variant="ghost" onClick={() => navigate(-1)}>
            Back to Settings
          </ZappButton>
        </div>
      )}

      {step === "enroll" && qrUri && (
        <div className="space-y-6">
          <div className="glass-card rounded-2xl p-6 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
            </p>
            <div className="bg-white rounded-xl p-4 inline-block mb-4">
              <QRCodeSVG value={qrUri} size={180} fgColor="#0B0B0F" bgColor="#ffffff" />
            </div>
            <p className="text-[10px] text-muted-foreground mb-2">Or enter this secret manually:</p>
            <button onClick={copySecret}
              className="inline-flex items-center gap-2 bg-foreground/5 rounded-lg px-4 py-2 text-xs font-mono">
              <span className="break-all">{secret}</span>
              {copied ? <Check size={14} className="text-accent shrink-0" /> : <Copy size={14} className="text-muted-foreground shrink-0" />}
            </button>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
              Enter verification code
            </p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="w-full h-14 bg-foreground/5 rounded-lg px-4 text-center text-2xl tracking-[0.5em] font-bold text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <ZappButton className="mt-4" onClick={handleVerify} loading={verifying} disabled={code.length !== 6}>
              <Shield size={16} /> Verify & Enable
            </ZappButton>
          </div>
        </div>
      )}

      {step === "enroll" && !qrUri && (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground mb-4">Failed to generate QR code.</p>
          <ZappButton onClick={enrollNew}>Try Again</ZappButton>
        </div>
      )}
    </div>
  );
}
