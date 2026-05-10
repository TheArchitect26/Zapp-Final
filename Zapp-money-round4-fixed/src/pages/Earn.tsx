import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Clock, Check, Trophy, ClipboardList, Gift, Users, Sparkles, Zap, Loader2, TrendingUp, PlayCircle, GraduationCap, Flame, ChevronRight } from "lucide-react";
import { useEarnOpportunities, useEarnCompletions, useCompleteEarn } from "@/lib/hooks/useEarn";
import { useDailyReward } from "@/lib/hooks/useDailyReward";
import { useAcademyLessons, useLessonCompletions } from "@/lib/hooks/useAcademy";
import { useCoinRate } from "@/lib/hooks/useCoinRate";
import { zcToDisplay, zcToNumber } from "@/lib/coins";
import { Progress } from "@/components/ui/progress";
import ZappButton from "@/components/ZappButton";
import { useProfile as useProfileForReferral } from "@/lib/store";
import { toast } from "sonner";

const SECTIONS = [
  { key: "all", label: "All", icon: TrendingUp },
  { key: "daily", label: "Daily", icon: Gift },
  { key: "survey", label: "Surveys", icon: ClipboardList },
  { key: "offers", label: "Offers", icon: Trophy },
  { key: "ads", label: "Ads", icon: PlayCircle },
  { key: "referral", label: "Referrals", icon: Users },
  { key: "academy", label: "Academy", icon: GraduationCap },
];

const CATEGORY_CONFIG: Record<string, { label: string; icon: typeof TrendingUp }> = {
  survey: { label: "Surveys", icon: ClipboardList },
  micro_task: { label: "Tasks", icon: Zap },
  referral: { label: "Referrals", icon: Users },
  daily_reward: { label: "Daily", icon: Gift },
  promo: { label: "Promos", icon: Sparkles },
  offerwall: { label: "Offers", icon: Trophy },
};

export default function Earn() {
  const [section, setSection] = useState("all");
  const { opportunities, isLoading: oppsLoading } = useEarnOpportunities();
  const { completedIds, completions, isLoading: compsLoading } = useEarnCompletions();
  const completeEarn = useCompleteEarn();
  const [activeOpp, setActiveOpp] = useState<string | null>(null);

  const handleComplete = async (oppId: string) => {
    setActiveOpp(oppId);
    try {
      await completeEarn.mutateAsync(oppId);
      toast.success("Reward earned! Wallet credited 🎉");
    } catch (err) {
      toast.error((err as Error).message || "Failed to complete");
    } finally {
      setActiveOpp(null);
    }
  };

  const isLoading = oppsLoading || compsLoading;

  return (
    <div className="min-h-screen pb-24 px-5 pt-12">
      <h1 className="text-xl font-bold tracking-tight mb-2">earn</h1>
      <p className="text-sm text-muted-foreground mb-6">Complete tasks to earn real money into your wallet</p>

      {/* Section Filters */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1 scrollbar-hide">
        {SECTIONS.map((s) => (
          <button key={s.key} onClick={() => setSection(s.key)}
            className={`shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
              section === s.key ? "bg-primary text-primary-foreground" : "bg-foreground/5 text-muted-foreground"
            }`}>
            <s.icon size={12} />
            {s.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Daily Rewards */}
          {(section === "all" || section === "daily") && <DailyRewardSection />}

          {/* Opportunities (Surveys, Offers, Ads) */}
          {(section === "all" || section === "survey" || section === "offers" || section === "ads") && (
            <OpportunitiesSection
              opportunities={opportunities}
              completedIds={completedIds}
              section={section}
              activeOpp={activeOpp}
              isPending={completeEarn.isPending}
              onComplete={handleComplete}
            />
          )}

          {/* Referrals */}
          {(section === "all" || section === "referral") && <ReferralSection />}

          {/* Academy */}
          {(section === "all" || section === "academy") && <AcademySection />}

          {/* Rewards History */}
          {section === "all" && completions.length > 0 && (
            <>
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3 mt-6">rewards history</h2>
              <div className="space-y-2 mb-6">
                {completions.slice(0, 10).map((c) => (
                  <div key={c.id} className="glass-card rounded-2xl p-4 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                      <Check size={16} className="text-accent" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">Reward earned</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(c.completed_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-accent">+R{(Number(c.coin_reward) / 100).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function DailyRewardSection() {
  const { streak, canClaim, claimDaily, claimLoading, baseRewards } = useDailyReward();
  const currentDay = streak?.current_streak || 0;

  const handleClaim = async () => {
    try {
      await claimDaily();
      toast.success("Daily reward claimed! 🔥");
    } catch (err) {
      toast.error((err as Error).message || "Failed to claim");
    }
  };

  return (
    <div className="mb-6">
      <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
        <Flame size={14} className="text-orange-400" /> Daily Rewards
      </h2>
      <div className="glass-card rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-bold text-sm">Day {currentDay} Streak</p>
            <p className="text-xs text-muted-foreground">
              {canClaim ? "Claim your daily reward!" : "Come back tomorrow!"}
            </p>
          </div>
          {streak?.longest_streak ? (
            <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-1 rounded-full font-semibold">
              Best: {streak.longest_streak} days
            </span>
          ) : null}
        </div>

        {/* 7-day cycle */}
        <div className="grid grid-cols-7 gap-1.5 mb-4">
          {baseRewards.map((reward, i) => {
            const day = i + 1;
            const isClaimed = day <= currentDay;
            const isNext = day === (canClaim ? (currentDay < 7 ? currentDay + 1 : 1) : currentDay + 1);
            return (
              <div key={day} className={`rounded-xl p-2 text-center transition-all ${
                isClaimed ? "bg-accent/20 border border-accent/30" :
                isNext && canClaim ? "bg-primary/20 border border-primary/30" :
                "bg-foreground/5"
              }`}>
                <p className="text-[10px] text-muted-foreground">Day {day}</p>
                <p className={`text-xs font-bold ${isClaimed ? "text-accent" : "text-foreground"}`}>R{reward.toFixed(2)}</p>
                {isClaimed && <Check size={10} className="text-accent mx-auto mt-0.5" />}
              </div>
            );
          })}
        </div>

        <ZappButton onClick={handleClaim} loading={claimLoading} disabled={!canClaim} className="w-full">
          {canClaim ? "Claim Daily Reward" : "Claimed Today ✓"}
        </ZappButton>
      </div>
    </div>
  );
}

function OpportunitiesSection({
  opportunities, completedIds, section, activeOpp, isPending, onComplete,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  opportunities: any[];
  completedIds: Set<string>;
  section: string;
  activeOpp: string | null;
  isPending: boolean;
  onComplete: (id: string) => void;
}) {
  const categoryMap: Record<string, string[]> = {
    survey: ["survey"],
    offers: ["offerwall", "micro_task"],
    ads: ["promo"],
  };

  const filtered = section === "all"
    ? opportunities
    : opportunities.filter((o) => (categoryMap[section] || []).includes(o.category));

  const available = filtered.filter((o) => !completedIds.has(o.id) || o.availability_type !== "once");

  if (available.length === 0 && section !== "all") {
    return (
      <div className="glass-card rounded-2xl p-10 text-center mb-6">
        <TrendingUp size={36} className="text-muted-foreground/30 mx-auto mb-3" />
        <p className="font-semibold text-sm mb-1">No tasks available</p>
        <p className="text-xs text-muted-foreground">Check back soon for new opportunities!</p>
      </div>
    );
  }

  if (available.length === 0) return null;

  return (
    <div className="space-y-3 mb-6">
      {available.map((opp, i) => {
        const done = completedIds.has(opp.id) && opp.availability_type === "once";
        const cfg = CATEGORY_CONFIG[opp.category] || { label: opp.category, icon: TrendingUp };
        const rewardValue = opp.estimated_fiat_value || (Number(opp.coin_reward) / 100);
        return (
          <motion.div key={opp.id} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            transition={{ delay: i * 0.03 }}
            className={`glass-card rounded-2xl p-5 ${done ? "opacity-50" : ""}`}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-foreground/5 px-2 py-0.5 rounded-full">
                    {cfg.label}
                  </span>
                </div>
                <p className="font-bold text-sm">{opp.title}</p>
                {opp.description && <p className="text-xs text-muted-foreground mt-0.5">{opp.description}</p>}
              </div>
              <div className="text-right ml-3">
                <p className="text-sm font-bold text-accent">R{rewardValue.toFixed(2)}</p>
              </div>
            </div>
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock size={12} />
                <span>{opp.estimated_minutes} min</span>
              </div>
              <ZappButton onClick={() => onComplete(opp.id)}
                loading={activeOpp === opp.id && isPending}
                disabled={done || isPending}>
                {done ? "Done" : "Start"}
              </ZappButton>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function ReferralSection() {
  const profile = useProfileForReferral();

  return (
    <div className="mb-6">
      <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
        <Users size={14} /> Referrals
      </h2>
      <div className="glass-card rounded-2xl p-5">
        <p className="font-bold text-sm mb-1">Invite friends, earn rewards</p>
        <p className="text-xs text-muted-foreground mb-4">Share your referral code and earn when friends join and complete actions</p>
        {profile?.referral_code ? (
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-foreground/5 rounded-xl px-4 py-3 font-mono-token text-sm font-bold tracking-wider">
              {profile.referral_code}
            </div>
            <ZappButton onClick={() => {
              navigator.clipboard.writeText(profile.referral_code || "");
              toast.success("Code copied!");
            }}>Copy</ZappButton>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Loading referral code...</p>
        )}
      </div>
    </div>
  );
}

function AcademySection() {
  const { lessons, isLoading } = useAcademyLessons();
  const { completedIds } = useLessonCompletions();
  const navigate = useNavigate();

  const totalLessons = lessons.length;
  const completedCount = lessons.filter(l => completedIds.has(l.id)).length;
  const progressPct = totalLessons > 0 ? (completedCount / totalLessons) * 100 : 0;

  return (
    <div className="mb-6">
      <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
        <GraduationCap size={14} /> Learn & Earn
      </h2>
      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
        </div>
      ) : (
        <button onClick={() => navigate("/academy")} className="w-full text-left glass-card rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
              <GraduationCap size={24} className="text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm">Zapp Academy</p>
              <p className="text-xs text-muted-foreground">{completedCount}/{totalLessons} lessons · Earn up to R12+</p>
            </div>
            <ChevronRight size={18} className="text-muted-foreground" />
          </div>
          <Progress value={progressPct} className="h-2" />
        </button>
      )}
    </div>
  );
}
