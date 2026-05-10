import { Home, ShoppingBag, Coins, Rss, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const tabs = [
  { path: "/", icon: Home, label: "Home" },
  { path: "/buy", icon: ShoppingBag, label: "Buy" },
  { path: "/earn", icon: Coins, label: "Earn" },
  { path: "/feed", icon: Rss, label: "Feed" },
  { path: "/profile", icon: User, label: "Profile" },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 glass border-t border-foreground/5">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {tabs.map((tab) => {
          const active = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className="flex flex-col items-center gap-0.5 py-1 px-3 relative"
            >
              {active && (
                <motion.div
                  layoutId="nav-glow"
                  className="absolute -top-1 w-8 h-1 rounded-full bg-primary shadow-glow-primary"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <tab.icon
                size={22}
                className={active ? "text-primary" : "text-muted-foreground"}
              />
              <span className={`text-[10px] font-medium ${active ? "text-primary" : "text-muted-foreground"}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
      <div className="h-safe-area-bottom" />
    </nav>
  );
}
