import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { motion, AnimatePresence } from "framer-motion";
import { X, CameraOff, AtSign, ArrowRight } from "lucide-react";
import ZappButton from "@/components/ZappButton";

interface QRScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (username: string) => void;
}

function parseZappQR(raw: string): string | null {
  const match = raw.match(/^zapp:\/\/pay\/(.+)$/);
  if (match) return match[1];
  try {
    const obj = JSON.parse(raw);
    if (obj?.app === "zapp" && obj?.username) return obj.username;
  } catch { /* ignore JSON parse errors */ }
  return null;
}

export default function QRScanner({ open, onClose, onScan }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const [started, setStarted]         = useState(false);
  const [cameraBlocked, setCameraBlocked] = useState(false);
  const [manualUsername, setManualUsername] = useState("");

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch { /* ignore stop errors */ }
      scannerRef.current = null;
    }
    setStarted(false);
  }, []);

  const startScanner = useCallback(async () => {
    if (!open || started || cameraBlocked) return;
    setError(null);

    try {
      const scanner = new Html5Qrcode("zapp-qr-reader");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          const username = parseZappQR(decodedText);
          if (username) {
            stopScanner();
            onScan(username);
          } else {
            setError("Not a valid Zapp QR code");
            setTimeout(() => setError(null), 2000);
          }
        },
        () => { /* ignore scan errors */ }
      );
      setStarted(true);
    } catch (err) {
      const msg: string = (err as Error)?.message || "";
      if (
        msg.toLowerCase().includes("permission") ||
        msg.toLowerCase().includes("notallowederror") ||
        msg.toLowerCase().includes("denied")
      ) {
        setCameraBlocked(true);
        setError("Camera access denied.");
      } else if (msg.toLowerCase().includes("notfound") || msg.toLowerCase().includes("no camera")) {
        setCameraBlocked(true);
        setError("No camera found on this device.");
      } else {
        setError("Could not start camera. Try entering the username manually.");
      }
    }
  }, [open, started, cameraBlocked, onScan, stopScanner]);

  useEffect(() => {
    if (open) {
      setCameraBlocked(false);
      setManualUsername("");
      const timer = setTimeout(startScanner, 300);
      return () => clearTimeout(timer);
    } else {
      stopScanner();
    }
    return () => { stopScanner(); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = () => { stopScanner(); onClose(); };

  const handleManualSubmit = () => {
    const clean = manualUsername.replace("@", "").trim();
    if (clean.length < 2) return;
    stopScanner();
    onScan(clean);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-background flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-12 pb-4 shrink-0">
            <h2 className="text-lg font-bold tracking-tight">scan to pay</h2>
            <button onClick={handleClose} className="p-2 rounded-full hover:bg-foreground/5">
              <X size={20} className="text-muted-foreground" />
            </button>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center px-5">

            {/* Camera scanner — hidden when blocked */}
            {!cameraBlocked && (
              <div className="relative w-full max-w-[280px] aspect-square rounded-3xl overflow-hidden mb-6">
                <div className="absolute inset-0 z-10 pointer-events-none">
                  <div className="absolute top-0 left-0 w-12 h-12 border-t-[3px] border-l-[3px] border-primary rounded-tl-2xl" />
                  <div className="absolute top-0 right-0 w-12 h-12 border-t-[3px] border-r-[3px] border-primary rounded-tr-2xl" />
                  <div className="absolute bottom-0 left-0 w-12 h-12 border-b-[3px] border-l-[3px] border-accent rounded-bl-2xl" />
                  <div className="absolute bottom-0 right-0 w-12 h-12 border-b-[3px] border-r-[3px] border-accent rounded-br-2xl" />
                  <motion.div
                    className="absolute left-4 right-4 h-0.5 bg-gradient-to-r from-primary via-secondary to-accent rounded-full"
                    initial={{ top: "15%" }}
                    animate={{ top: ["15%", "85%", "15%"] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                  />
                </div>
                <div id="zapp-qr-reader" className="w-full h-full bg-foreground/5 rounded-3xl" />

                {error && !cameraBlocked && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
                    <p className="text-sm text-destructive font-medium text-center">{error}</p>
                  </div>
                )}
              </div>
            )}

            {/* Manual entry fallback — shown when camera is blocked */}
            {cameraBlocked && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-sm space-y-4 mb-6"
              >
                <div className="flex flex-col items-center gap-3 py-6">
                  <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                    <CameraOff size={28} className="text-destructive" />
                  </div>
                  <p className="text-sm font-semibold text-center">{error}</p>
                  <p className="text-xs text-muted-foreground text-center">
                    To enable camera: open your browser's site settings and allow camera
                    access for this page, then refresh.
                  </p>
                </div>

                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest text-center">
                  — or enter username manually —
                </p>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <AtSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={manualUsername}
                      onChange={(e) => setManualUsername(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
                      placeholder="username"
                      autoFocus
                      className="w-full h-12 bg-foreground/5 rounded-lg pl-9 pr-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium"
                    />
                  </div>
                  <button
                    onClick={handleManualSubmit}
                    disabled={manualUsername.replace("@", "").trim().length < 2}
                    className="h-12 px-4 rounded-lg bg-primary text-primary-foreground font-bold disabled:opacity-30 flex items-center gap-1"
                  >
                    <ArrowRight size={18} />
                  </button>
                </div>
              </motion.div>
            )}

            {!cameraBlocked && (
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">Point at a Zapp QR code</p>
                <p className="text-xs text-muted-foreground/60">Only Zapp payment QR codes are accepted</p>
              </div>
            )}
          </div>

          <div className="shrink-0 pb-12 pt-4 text-center">
            <p className="text-xs text-muted-foreground/40 tracking-widest uppercase">powered by zapp</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
