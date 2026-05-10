import { useState } from "react";
import { motion } from "framer-motion";
import { Heart, Loader2, TrendingUp, Settings2, Eye, EyeOff, UserX } from "lucide-react";
import { useFeedEvents, useFeedProfiles, useFeedLikes, useToggleLike, useFeedVisibility } from "@/lib/hooks/useFeed";
import { useAuth } from "@/lib/auth";
import { Switch } from "@/components/ui/switch";

export default function Feed() {
  const { events, isLoading } = useFeedEvents();
  const { user } = useAuth();
  const [showSettings, setShowSettings] = useState(false);

  const userIds = events.map((e) => e.user_id);
  const profileMap = useFeedProfiles(userIds);
  const eventIds = events.map((e) => e.id);
  const { likeCounts, userLikes } = useFeedLikes(eventIds);
  const toggleLike = useToggleLike();
  const { settings, updateVisibility } = useFeedVisibility();

  const handleLike = (eventId: string) => {
    const liked = userLikes.has(eventId);
    toggleLike.mutate({ eventId, liked });
  };

  const eventTypeIcons: Record<string, string> = {
    earning: "💰",
    transfer: "💸",
    referral: "🤝",
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="min-h-screen pb-24 px-5 pt-12">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight">feed</h1>
          <p className="text-sm text-muted-foreground">See what's happening on Zapp</p>
        </div>
        <button onClick={() => setShowSettings(!showSettings)}
          className="w-9 h-9 rounded-full bg-foreground/5 flex items-center justify-center">
          <Settings2 size={16} className="text-muted-foreground" />
        </button>
      </div>

      {/* Privacy Settings */}
      {showSettings && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
          className="glass-card rounded-2xl p-5 mb-5 space-y-4">
          <h3 className="text-sm font-bold">Privacy Settings</h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye size={14} className="text-muted-foreground" />
              <span className="text-sm">Show my activity</span>
            </div>
            <Switch checked={settings.show_activity}
              onCheckedChange={(v) => updateVisibility({ show_activity: v })} />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <EyeOff size={14} className="text-muted-foreground" />
              <span className="text-sm">Show amounts</span>
            </div>
            <Switch checked={settings.show_amounts}
              onCheckedChange={(v) => updateVisibility({ show_amounts: v })} />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserX size={14} className="text-muted-foreground" />
              <span className="text-sm">Anonymous mode</span>
            </div>
            <Switch checked={settings.anonymous_mode}
              onCheckedChange={(v) => updateVisibility({ anonymous_mode: v })} />
          </div>
        </motion.div>
      )}

      {/* Feed */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : events.length === 0 ? (
        <div className="glass-card rounded-2xl p-10 text-center">
          <TrendingUp size={36} className="text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-semibold text-sm mb-1">No activity yet</p>
          <p className="text-xs text-muted-foreground">When people earn, transfer, and refer — it shows here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event, i) => {
            const profile = profileMap.get(event.user_id);
            const isOwn = event.user_id === user?.id;
            const username = profile?.username ? `@${profile.username}` : "Zapp User";
            const fullName = profile?.full_name || "User";
            const likes = likeCounts.get(event.id) || 0;
            const liked = userLikes.has(event.id);
            const icon = eventTypeIcons[event.event_type] || "⚡";

            return (
              <motion.div key={event.id} initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                className="glass-card rounded-2xl p-5">
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-lg">
                    {icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold truncate">{fullName}</p>
                      <span className="text-xs text-muted-foreground">{username}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{event.title}</p>
                    {event.description && (
                      <p className="text-xs text-muted-foreground/70 mt-0.5">{event.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-3">
                        <button onClick={() => handleLike(event.id)}
                          className={`flex items-center gap-1 text-xs transition-all ${liked ? "text-red-400" : "text-muted-foreground"}`}>
                          <Heart size={14} fill={liked ? "currentColor" : "none"} />
                          {likes > 0 && <span>{likes}</span>}
                        </button>
                        <span className="text-[10px] text-muted-foreground/60">{timeAgo(event.created_at)}</span>
                      </div>
                      {event.amount && !event.hide_amount && (
                        <span className="text-sm font-bold text-accent">+R{Number(event.amount).toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
