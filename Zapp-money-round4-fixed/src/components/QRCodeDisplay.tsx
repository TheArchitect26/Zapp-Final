import { QRCodeSVG } from "qrcode.react";
import { useProfile } from "@/lib/store";
import { Share2, Copy, Check, Loader2 } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

export default function QRCodeDisplay() {
  const profile = useProfile();
  const [copied, setCopied] = useState(false);
  const [qrError, setQrError] = useState(false);

  // Stable, canonical QR value — always use the deep-link format so the
  // scanner's parseZappQR() can decode it without JSON.parse.
  const qrValue = useMemo(() => {
    if (!profile?.username) return null;
    return `zapp://pay/${profile.username}`;
  }, [profile?.username]);

  // Loading state — profile not yet fetched
  if (profile === undefined || profile === null) {
    return (
      <div className="glass-card rounded-2xl p-6 flex items-center justify-center min-h-[280px]">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Profile loaded but no username set
  if (!qrValue) {
    return (
      <div className="glass-card rounded-2xl p-6 text-center">
        <p className="text-sm text-muted-foreground">Set a username to generate your QR code.</p>
      </div>
    );
  }

  const paymentLink = `zapp://pay/${profile.username}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(paymentLink).then(() => {
      setCopied(true);
      toast.success("Payment link copied!");
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => toast.error("Failed to copy"));
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Pay me on Zapp",
          text: `Send money to @${profile.username} on Zapp`,
          url: paymentLink,
        });
      } catch { /* user cancelled */ }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="glass-card rounded-2xl p-6 text-center">
      <p className="text-xs text-muted-foreground uppercase tracking-widest mb-4">my zapp pay</p>

      {/* Branded QR container */}
      <div className="relative inline-block mb-4">
        <div className="bg-white rounded-2xl p-4 relative">
          {qrError ? (
            <div className="w-[180px] h-[180px] flex items-center justify-center bg-muted rounded-xl">
              <p className="text-xs text-muted-foreground text-center px-2">QR unavailable</p>
            </div>
          ) : (
            <QRCodeSVG
              value={qrValue}
              size={180}
              level="M"
              fgColor="#0B0B0F"
              bgColor="#ffffff"
              onError={() => setQrError(true)}
            />
          )}
          {/* Center logo overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-10 h-10 rounded-xl bg-[#0B0B0F] flex items-center justify-center shadow-lg">
              <span className="text-sm font-extrabold text-white tracking-tight">Z</span>
            </div>
          </div>
        </div>
        {/* Gradient border glow */}
        <div className="absolute -inset-[2px] rounded-[18px] bg-gradient-to-br from-primary via-secondary to-accent -z-10 opacity-60 blur-[1px]" />
      </div>

      <p className="text-sm font-bold mb-0.5">@{profile.username}</p>
      <p className="text-xs text-muted-foreground mb-4">Scan to pay me instantly</p>

      <div className="flex gap-2 justify-center">
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-4 h-10 rounded-lg bg-foreground/5 text-sm font-semibold active:scale-95 transition-transform"
        >
          {copied ? <Check size={14} className="text-accent" /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy Link"}
        </button>
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 px-4 h-10 rounded-lg bg-primary/10 text-primary text-sm font-semibold active:scale-95 transition-transform"
        >
          <Share2 size={14} /> Share
        </button>
      </div>
    </div>
  );
}
