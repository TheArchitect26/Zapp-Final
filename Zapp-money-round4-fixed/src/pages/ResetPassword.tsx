import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Zap } from "lucide-react";
import ZappButton from "@/components/ZappButton";
import { supabase } from "@/integrations/supabase/client";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleReset = async () => {
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
    } catch (err) {
      setError((err as Error).message || "Failed to reset password");
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

        {done ? (
          <div className="text-center">
            <h1 className="text-xl font-bold mb-2">password updated!</h1>
            <p className="text-sm text-muted-foreground mb-6">you can now log in with your new password.</p>
            <ZappButton onClick={() => navigate("/login")}>Go to Login</ZappButton>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold text-center mb-1">set new password</h1>
            <p className="text-sm text-muted-foreground text-center mb-8">enter your new password below.</p>

            {error && (
              <div className="bg-destructive/10 text-destructive text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
            )}

            <div className="space-y-3">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password"
                className="w-full h-14 bg-foreground/5 rounded-lg px-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium"
              />
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirm password"
                className="w-full h-14 bg-foreground/5 rounded-lg px-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium"
              />
              <ZappButton onClick={handleReset} loading={loading} disabled={!password || !confirm}>
                Reset Password
              </ZappButton>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
