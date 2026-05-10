import { useState, useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { useRealtimeWallet } from "@/lib/hooks/useRealtime";
import SplashScreen from "@/components/SplashScreen";
import BottomNav from "@/components/BottomNav";
import Home from "@/pages/Home";
import Buy from "@/pages/Buy";
import Vouchers from "@/pages/Vouchers";
import Earn from "@/pages/Earn";
import Academy from "@/pages/Academy";
import Transfer from "@/pages/Transfer";
import Feed from "@/pages/Feed";
import Withdraw from "@/pages/Withdraw";
import Activity from "@/pages/Activity";
import Profile from "@/pages/Profile";
import Settings from "@/pages/Settings";
import TermsOfService from "@/pages/TermsOfService";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import HelpSupport from "@/pages/HelpSupport";
import TwoFactorSetup from "@/pages/TwoFactorSetup";
import Notifications from "@/pages/Notifications";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import AdminLogin from "@/pages/admin/AdminLogin";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import TopUpResult from "@/pages/TopUpResult";
import KYCVerification from "@/pages/KYCVerification";
import NotFound from "@/pages/NotFound";
import { useIsAdmin } from "@/lib/hooks/useAdmin";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-background" />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-background" />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { data: isAdmin, isLoading } = useIsAdmin();
  if (loading || isLoading) return <div className="min-h-screen bg-background" />;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RealtimeProvider({ children }: { children: React.ReactNode }) {
  useRealtimeWallet();
  return <>{children}</>;
}

function AppRoutes() {
  const [splashDone, setSplashDone] = useState(false);
  const handleSplashComplete = useCallback(() => setSplashDone(true), []);

  if (!splashDone) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  return (
    <RealtimeProvider>
      <div className="max-w-lg mx-auto relative">
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
          <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/top-up/result" element={<TopUpResult />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/buy" element={<ProtectedRoute><Buy /></ProtectedRoute>} />
          <Route path="/vouchers" element={<ProtectedRoute><Vouchers /></ProtectedRoute>} />
          <Route path="/earn" element={<ProtectedRoute><Earn /></ProtectedRoute>} />
          <Route path="/academy" element={<ProtectedRoute><Academy /></ProtectedRoute>} />
          <Route path="/transfer" element={<ProtectedRoute><Transfer /></ProtectedRoute>} />
          <Route path="/feed" element={<ProtectedRoute><Feed /></ProtectedRoute>} />
          <Route path="/withdraw" element={<ProtectedRoute><Withdraw /></ProtectedRoute>} />
          <Route path="/activity" element={<ProtectedRoute><Activity /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/terms" element={<ProtectedRoute><TermsOfService /></ProtectedRoute>} />
          <Route path="/privacy" element={<ProtectedRoute><PrivacyPolicy /></ProtectedRoute>} />
          <Route path="/help" element={<ProtectedRoute><HelpSupport /></ProtectedRoute>} />
          <Route path="/two-factor" element={<ProtectedRoute><TwoFactorSetup /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
          <Route path="/kyc" element={<ProtectedRoute><KYCVerification /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <ProtectedNav />
      </div>
    </RealtimeProvider>
  );
}

function ProtectedNav() {
  const { user } = useAuth();
  if (!user) return null;
  return <BottomNav />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
