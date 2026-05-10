import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Zap } from "lucide-react";
import ZappButton from "@/components/ZappButton";
import { useAuth } from "@/lib/auth";

export default function Signup() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSignup = async () => {
    setError("");
    if (!fullName || !username || !email || !password) {
      setError("All fields are required");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (!/[0-9!@#$%^&*]/.test(password)) {
      setError("Password must contain at least one number or symbol");
      return;
    }
    setLoading(true);
    try {
      await signUp(email, password, { full_name: fullName, username: username.replace("@", "") });
      setSuccess(true);
    } catch (err) {
      setError((err as Error).message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
          <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-4">
            <Zap size={32} className="text-accent" />
          </div>
          <h2 className="text-xl font-bold mb-2">check your email</h2>
          <p className="text-sm text-muted-foreground mb-6">we sent a confirmation link to {email}</p>
          <ZappButton variant="ghost" onClick={() => navigate("/login")}>
            back to login
          </ZappButton>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-sm"
      >
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Zap size={22} className="text-primary-foreground" />
          </div>
          <span className="text-2xl font-extrabold tracking-tight">zapp</span>
        </div>

        <h1 className="text-xl font-bold text-center mb-1">create account</h1>
        <p className="text-sm text-muted-foreground text-center mb-8">money moves faster.</p>

        {error && (
          <div className="bg-destructive/10 text-destructive text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Full name"
            className="w-full h-14 bg-foreground/5 rounded-lg px-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium"
          />
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username (e.g. @celumusa)"
            className="w-full h-14 bg-foreground/5 rounded-lg px-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium"
          />
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
            placeholder="Password (min 8 characters, include a number or symbol)"
            className="w-full h-14 bg-foreground/5 rounded-lg px-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium"
          />
          <ZappButton onClick={handleSignup} loading={loading}>
            Create Account
          </ZappButton>
        </div>

        <p className="text-sm text-center mt-6 text-muted-foreground">
          already have an account?{" "}
          <button onClick={() => navigate("/login")} className="text-primary font-semibold">
            log in
          </button>
        </p>
      </motion.div>
    </div>
  );
}
