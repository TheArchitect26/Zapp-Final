import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import ZappButton from "@/components/ZappButton";
import { toast } from "sonner";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async () => {
    setLoading(true);
    try {
      await signIn(email, password);
      // Check admin role
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Login failed");

      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });

      if (!isAdmin) {
        await supabase.auth.signOut();
        throw new Error("Access denied. Admin privileges required.");
      }

      navigate("/admin");
    } catch (err) {
      toast.error((err as Error).message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-5 bg-background">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-extrabold tracking-tight mb-1">zapp admin</h1>
          <p className="text-sm text-muted-foreground">Sign in with admin credentials</p>
        </div>
        <div className="glass-card rounded-2xl p-6 space-y-4">
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="Admin email"
            className="w-full h-12 bg-foreground/5 rounded-lg px-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
          />
          <input
            type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full h-12 bg-foreground/5 rounded-lg px-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
          />
          <ZappButton onClick={handleLogin} loading={loading} disabled={!email || !password}>
            Sign In
          </ZappButton>
        </div>
      </div>
    </div>
  );
}
