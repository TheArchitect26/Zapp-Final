import { useState } from "react";
import { motion } from "framer-motion";
import {
  Bell, Shield, Lock, Eye, EyeOff, LogOut, ChevronRight,
  User, FileText, HelpCircle, Trash2
} from "lucide-react";
import { useProfile } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { usePushNotifications } from "@/lib/hooks/usePushNotifications";
import ZappButton from "@/components/ZappButton";

export default function Settings() {
  const profile = useProfile();
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Profile edit state
  const [editingProfile, setEditingProfile] = useState(false);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [saving, setSaving] = useState(false);

  // Security
  const [changingPassword, setChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  const startEditProfile = () => {
    setFullName(profile?.full_name || "");
    setUsername(profile?.username || "");
    setPhoneNumber(profile?.phone_number || "");
    setEditingProfile(true);
  };

  const handleSaveProfile = async () => {
    if (!username.trim()) {
      toast.error("Username is required");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim() || null,
          username: username.trim(),
          phone_number: phoneNumber.trim() || null,
        })
        .eq("user_id", user!.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
      toast.success("Profile updated");
      setEditingProfile(false);
    } catch (err) {
      toast.error((err as Error).message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    setPasswordSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Password updated successfully");
      setChangingPassword(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error((err as Error).message || "Failed to update password");
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const push = usePushNotifications();

  return (
    <div className="min-h-screen pb-24 px-5 pt-12">
      <h1 className="text-xl font-bold tracking-tight mb-6">settings</h1>

      {/* Personal Information */}
      <SectionLabel label="personal information" />
      {editingProfile ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card rounded-2xl p-5 mb-4 space-y-3">
          <InputField label="Full name" value={fullName} onChange={setFullName} placeholder="Your name" />
          <InputField label="Username" value={username} onChange={setUsername} placeholder="@handle" />
          <InputField label="Phone" value={phoneNumber} onChange={setPhoneNumber} placeholder="0XX XXX XXXX" type="tel" />
          <div className="flex gap-2 pt-1">
            <ZappButton onClick={handleSaveProfile} loading={saving}>Save</ZappButton>
            <ZappButton variant="ghost" onClick={() => setEditingProfile(false)}>Cancel</ZappButton>
          </div>
        </motion.div>
      ) : (
        <button onClick={startEditProfile} className="w-full glass-card rounded-2xl p-4 flex items-center gap-3 mb-4 text-left">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <User size={18} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{profile?.full_name || "Set your name"}</p>
            <p className="text-xs text-muted-foreground truncate">@{profile?.username || "username"} · {profile?.phone_number || "No phone"}</p>
          </div>
          <ChevronRight size={16} className="text-muted-foreground shrink-0" />
        </button>
      )}

      {/* Security */}
      <SectionLabel label="security" />
      <div className="glass-card rounded-2xl divide-y divide-foreground/5 mb-4">
        <button onClick={() => setChangingPassword(!changingPassword)} className="flex items-center gap-3 w-full px-5 py-4 text-left">
          <Lock size={18} className="text-secondary" />
          <span className="flex-1 text-sm font-semibold">Change Password</span>
          <ChevronRight size={16} className={`text-muted-foreground transition-transform ${changingPassword ? "rotate-90" : ""}`} />
        </button>
        {changingPassword && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-5 py-4 space-y-3">
            <InputField label="New password" value={newPassword} onChange={setNewPassword} placeholder="Min 6 characters" type="password" />
            <InputField label="Confirm password" value={confirmPassword} onChange={setConfirmPassword} placeholder="Repeat password" type="password" />
            <ZappButton onClick={handleChangePassword} loading={passwordSaving} disabled={!newPassword || !confirmPassword}>
              Update Password
            </ZappButton>
          </motion.div>
        )}
        <button onClick={() => navigate("/two-factor")} className="flex items-center gap-3 w-full px-5 py-4 text-left">
          <Shield size={18} className="text-accent" />
          <span className="flex-1 text-sm font-semibold">Two-Factor Auth</span>
          <ChevronRight size={16} className="text-muted-foreground" />
        </button>
      </div>

      {/* Notifications */}
      <SectionLabel label="notifications" />
      <div className="glass-card rounded-2xl divide-y divide-foreground/5 mb-4">
        <button onClick={() => navigate("/notifications")} className="flex items-center gap-3 w-full px-5 py-4 text-left">
          <Bell size={18} className="text-secondary" />
          <span className="flex-1 text-sm font-semibold">View Notifications</span>
          <ChevronRight size={16} className="text-muted-foreground" />
        </button>
        {push.supported && (
          <div className="flex items-center gap-3 w-full px-5 py-4">
            <Bell size={18} className="text-primary" />
            <span className="flex-1 text-sm font-semibold">Push Notifications</span>
            <button
              onClick={push.subscribed ? push.unsubscribe : push.subscribe}
              disabled={push.loading}
              className={`w-12 h-6 rounded-full transition-colors ${push.subscribed ? "bg-primary" : "bg-foreground/20"}`}
            >
              <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform mx-0.5 ${push.subscribed ? "translate-x-6" : "translate-x-0"}`} />
            </button>
          </div>
        )}
      </div>

      {/* About & Legal */}
      <SectionLabel label="about" />
      <div className="glass-card rounded-2xl divide-y divide-foreground/5 mb-4">
        <button onClick={() => navigate("/terms")} className="flex items-center gap-3 w-full px-5 py-4 text-left">
          <FileText size={18} className="text-muted-foreground" />
          <span className="flex-1 text-sm font-semibold">Terms of Service</span>
          <ChevronRight size={16} className="text-muted-foreground" />
        </button>
        <button onClick={() => navigate("/privacy")} className="flex items-center gap-3 w-full px-5 py-4 text-left">
          <Shield size={18} className="text-muted-foreground" />
          <span className="flex-1 text-sm font-semibold">Privacy Policy</span>
          <ChevronRight size={16} className="text-muted-foreground" />
        </button>
        <button onClick={() => navigate("/help")} className="flex items-center gap-3 w-full px-5 py-4 text-left">
          <HelpCircle size={18} className="text-muted-foreground" />
          <span className="flex-1 text-sm font-semibold">Help & Support</span>
          <ChevronRight size={16} className="text-muted-foreground" />
        </button>
      </div>

      {/* Account Actions */}
      <SectionLabel label="account" />
      <div className="space-y-2 mb-4">
        <button onClick={handleLogout} className="flex items-center gap-3 w-full glass-card rounded-2xl px-5 py-4 text-left">
          <LogOut size={18} className="text-destructive" />
          <span className="text-sm font-semibold text-destructive">Logout</span>
        </button>
      </div>

      <p className="text-center text-[10px] text-muted-foreground/40 mt-8">Zapp v1.0.0 · Made in South Africa 🇿🇦</p>
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 mt-2">{label}</p>;
}

function InputField({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string;
}) {
  return (
    <div>
      <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1 block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-12 bg-foreground/5 rounded-lg px-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium text-sm"
      />
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MenuItem({ icon: Icon, label, color, note }: { icon: any; label: string; color: string; note?: string }) {
  return (
    <div className="flex items-center gap-3 w-full px-5 py-4">
      <Icon size={18} className={color} />
      <span className="flex-1 text-sm font-semibold">{label}</span>
      {note && <span className="text-[10px] text-muted-foreground bg-foreground/5 px-2 py-0.5 rounded-full">{note}</span>}
    </div>
  );
}
