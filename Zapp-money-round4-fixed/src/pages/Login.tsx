import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Zap } from "lucide-react";
import ZappButton from "@/components/ZappButton";
import { useAuth } from "@/lib/auth";

export default function Login() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      await signIn(email, password);
      navigate("/");
    } catch (err) {
      setError((err as Error).message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Zap size={22} className="text-primary-foreground" />
          </div>
          <span className="text-2xl font-extrabold tracking-tight">zapp</span>
        </div>

        <h1 className="text-xl font-bold text-center mb-1">welcome back</h1>
        <p className="text-sm text-muted-foreground text-center mb-8">money moves faster.</p>

        {error && (
          <div className="bg-destructive/10 text-destructive text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full h-14 bg-foreground/5 rounded-lg px-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full h-14 bg-foreground/5 rounded-lg px-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium"
          />
          <ZappButton onClick={handleLogin} loading={loading}>
            Log In
          </ZappButton>
        </div>

        <button onClick={() => navigate("/forgot-password")} className="block text-sm text-muted-foreground text-center mt-4">
          forgot password?
        </button>
        <p className="text-sm text-center mt-3 text-muted-foreground">
          don't have an account?{" "}
          <button onClick={() => navigate("/signup")} className="text-primary font-semibold">
            sign up
          </button>
        </p>
      </motion.div>
    </div>
  );
}
