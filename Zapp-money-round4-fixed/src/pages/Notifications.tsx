import { motion } from "framer-motion";
import { Bell, Check, CheckCheck } from "lucide-react";
import { useNotifications } from "@/lib/hooks/useNotifications";
import ZappButton from "@/components/ZappButton";

const typeColors: Record<string, string> = {
  purchase: "text-primary",
  topup: "text-accent",
  transfer: "text-secondary",
  reward: "text-accent",
  conversion: "text-primary",
  info: "text-muted-foreground",
};

export default function Notifications() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();

  return (
    <div className="min-h-screen pb-24 px-5 pt-12">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold tracking-tight">notifications</h1>
        {unreadCount > 0 && (
          <button onClick={() => markAllRead()} className="flex items-center gap-1 text-xs text-primary font-semibold">
            <CheckCheck size={14} /> Mark all read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-16">
          <Bell size={40} className="text-muted-foreground mx-auto mb-3 opacity-30" />
          <p className="text-sm text-muted-foreground">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n, i) => (
            <motion.div
              key={n.id}
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: i * 0.02 }}
              onClick={() => !n.read && markRead(n.id)}
              className={`glass-card rounded-2xl p-4 cursor-pointer transition-all ${!n.read ? "border-l-2 border-primary" : "opacity-60"}`}
            >
              <div className="flex items-start gap-3">
                <Bell size={16} className={typeColors[n.type] || "text-muted-foreground"} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
                {!n.read && <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
