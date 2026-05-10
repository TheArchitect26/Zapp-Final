import { Award, Target, Flame, GraduationCap, Crown, Lock, Loader2 } from "lucide-react";
import { useBadges, useUserBadges, useEvaluateBadges } from "@/lib/hooks/useBadges";
import { useEffect } from "react";
import { toast } from "sonner";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ICONS: Record<string, any> = {
  award: Award,
  target: Target,
  flame: Flame,
  "graduation-cap": GraduationCap,
  crown: Crown,
};

export default function BadgesGrid({ autoEvaluate = true }: { autoEvaluate?: boolean }) {
  const { data: badges = [], isLoading } = useBadges();
  const { data: earned = [] } = useUserBadges();
  const evaluate = useEvaluateBadges();

  useEffect(() => {
    if (!autoEvaluate) return;
    evaluate.mutateAsync().then((res: unknown) => {
      if (res && Array.isArray(res) && res.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        res.forEach((b: any) => {
          if (b.bonus_paid > 0) {
            toast.success(`🏆 Badge unlocked! +R${b.bonus_paid}`);
          }
        });
      }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoEvaluate]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const earnedIds = new Set(earned.map((e: any) => e.badge_id));

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="animate-spin text-muted-foreground" size={20} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Badges · {earned.length}/{badges.length}
        </h3>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {badges.map((b: any) => {
          const Icon = ICONS[b.icon] || Award;
          const unlocked = earnedIds.has(b.id);
          return (
            <div
              key={b.id}
              className={`glass-card rounded-2xl p-4 border transition-all ${
                unlocked ? b.color_class : "border-foreground/10 opacity-60"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${unlocked ? "" : "bg-foreground/5"}`}>
                  {unlocked ? <Icon size={20} /> : <Lock size={16} className="text-muted-foreground" />}
                </div>
                {b.bonus_reward > 0 && (
                  <span className="text-xs font-bold">+R{Number(b.bonus_reward).toFixed(2)}</span>
                )}
              </div>
              <p className="font-bold text-sm">{b.name}</p>
              <p className="text-xs text-muted-foreground line-clamp-2">{b.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
