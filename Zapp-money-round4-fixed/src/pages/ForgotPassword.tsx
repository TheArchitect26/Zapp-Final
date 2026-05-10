import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Zap, ArrowLeft } from "lucide-react";
import ZappButton from "@/components/ZappButton";
import { supabase } from "@/integrations/supabase/client";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleReset = async () => {
    setError("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError((err as Error).message || "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Zap size={22} className="text-primary-foreground" />
          </div>
          <span className="text-2xl font-extrabold tracking-tight">zapp</span>
        </div>

        {sent ? (
          <div className="text-center">
            <h1 className="text-xl font-bold mb-2">check your email</h1>
            <p className="text-sm text-muted-foreground mb-6">
              we sent a password reset link to <span className="text-foreground font-medium">{email}</span>
            </p>
            <ZappButton variant="ghost" onClick={() => navigate("/login")}>
              back to login
            </ZappButton>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold text-center mb-1">forgot password?</h1>
            <p className="text-sm text-muted-foreground text-center mb-8">
              enter your email and we'll send a reset link.
            </p>

            {error && (
              <div className="bg-destructive/10 text-destructive text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
            )}

            <div className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full h-14 bg-foreground/5 rounded-lg px-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium"
              />
              <ZappButton onClick={handleReset} loading={loading} disabled={!email}>
                Send Reset Link
              </ZappButton>
            </div>

            <button onClick={() => navigate("/login")} className="flex items-center gap-1 text-sm text-muted-foreground mt-6 mx-auto">
              <ArrowLeft size={14} /> back to login
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}
