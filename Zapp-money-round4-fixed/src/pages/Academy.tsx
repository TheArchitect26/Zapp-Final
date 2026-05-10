import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Check, ChevronRight, Clock, GraduationCap, Loader2, Lock, Trophy, Sparkles } from "lucide-react";
import { useAcademyLessons, useLessonCompletions, useCompleteLesson, useAcademyQuizzes, useSubmitQuizAnswer } from "@/lib/hooks/useAcademy";
import { Progress } from "@/components/ui/progress";
import ZappButton from "@/components/ZappButton";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import BadgesGrid from "@/components/BadgesGrid";

const CATEGORY_ICONS: Record<string, string> = {
  "Getting Started": "🧠",
  "Surveys Mastery": "📊",
  "Earn Faster": "⚡",
  "Referrals & Growth": "👥",
  "Withdraw & Use Money": "💰",
};

export default function Academy() {
  const navigate = useNavigate();
  const { lessons, categories, isLoading } = useAcademyLessons();
  const { completedIds } = useLessonCompletions();
  const [selectedLesson, setSelectedLesson] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const totalLessons = lessons.length;
  const completedCount = lessons.filter(l => completedIds.has(l.id)).length;
  const progressPct = totalLessons > 0 ? (completedCount / totalLessons) * 100 : 0;
  const totalEarned = lessons
    .filter(l => completedIds.has(l.id))
    .reduce((sum, l) => sum + Number(l.coin_reward) / 100, 0);

  const lesson = lessons.find(l => l.id === selectedLesson);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (lesson) {
    return <LessonViewer lesson={lesson} completed={completedIds.has(lesson.id)} onBack={() => setSelectedLesson(null)} />;
  }

  if (selectedCategory) {
    const catLessons = lessons.filter(l => l.category === selectedCategory);
    const catCompleted = catLessons.filter(l => completedIds.has(l.id)).length;
    return (
      <div className="min-h-screen pb-24 px-5 pt-12">
        <button onClick={() => setSelectedCategory(null)} className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
          <ArrowLeft size={16} /> Back to Academy
        </button>
        <h1 className="text-xl font-bold mb-1">{CATEGORY_ICONS[selectedCategory]} {selectedCategory}</h1>
        <p className="text-xs text-muted-foreground mb-4">{catCompleted}/{catLessons.length} lessons completed</p>
        <Progress value={(catCompleted / catLessons.length) * 100} className="h-2 mb-6" />
        <div className="space-y-3">
          {catLessons.map((l, i) => {
            const done = completedIds.has(l.id);
            const reward = Number(l.coin_reward) / 100;
            return (
              <motion.button key={l.id} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => setSelectedLesson(l.id)}
                className={`w-full text-left glass-card rounded-2xl p-4 flex items-center gap-3 ${done ? "opacity-60" : ""}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${done ? "bg-accent/20 text-accent" : "bg-primary/20 text-primary"}`}>
                  {done ? <Check size={18} /> : i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{l.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{l.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-accent">R{reward.toFixed(2)}</p>
                  <ChevronRight size={14} className="text-muted-foreground ml-auto" />
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 px-5 pt-12">
      <button onClick={() => navigate("/earn")} className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
        <ArrowLeft size={16} /> Back to Earn
      </button>
      <div className="flex items-center gap-2 mb-1">
        <GraduationCap size={22} className="text-primary" />
        <h1 className="text-xl font-bold">Zapp Academy</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">Learn to earn more. Get rewarded for knowledge.</p>

      {/* Progress Card */}
      <div className="glass-card rounded-2xl p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-bold">{completedCount}/{totalLessons} Lessons</p>
            <p className="text-xs text-muted-foreground">{Math.round(progressPct)}% complete</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-accent">R{totalEarned.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">earned</p>
          </div>
        </div>
        <Progress value={progressPct} className="h-2.5" />
        {completedCount === totalLessons && totalLessons > 0 && (
          <div className="flex items-center gap-2 mt-3 bg-accent/10 rounded-xl p-3">
            <Trophy size={18} className="text-accent" />
            <p className="text-xs font-semibold text-accent">Academy Complete! You're a Zapp Pro 🎉</p>
          </div>
        )}
      </div>

      {/* Badges & Gamification */}
      <div className="mb-6">
        <BadgesGrid />
      </div>

      {/* Categories */}
      <div className="space-y-3">
        {categories.map((cat, i) => {
          const catLessons = lessons.filter(l => l.category === cat);
          const catDone = catLessons.filter(l => completedIds.has(l.id)).length;
          const catPct = (catDone / catLessons.length) * 100;
          return (
            <motion.button key={cat} initial={{ y: 15, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => setSelectedCategory(cat)}
              className="w-full text-left glass-card rounded-2xl p-5 flex items-center gap-4">
              <div className="text-2xl">{CATEGORY_ICONS[cat] || "📖"}</div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm">{cat}</p>
                <p className="text-xs text-muted-foreground">{catDone}/{catLessons.length} lessons</p>
                <Progress value={catPct} className="h-1.5 mt-2" />
              </div>
              <ChevronRight size={18} className="text-muted-foreground shrink-0" />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function LessonViewer({ lesson, completed, onBack }: { lesson: any; completed: boolean; onBack: () => void }) {
  const completeLesson = useCompleteLesson();
  const { quizzes, isLoading: quizLoading } = useAcademyQuizzes(lesson.id);
  const submitAnswer = useSubmitQuizAnswer();
  const [quizMode, setQuizMode] = useState(false);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [quizDone, setQuizDone] = useState(false);
  const [startTime] = useState(Date.now());
  const [completing, setCompleting] = useState(false);

  const hasQuiz = lesson.has_quiz && quizzes.length > 0;
  const minTime = (lesson.min_time_seconds || 30) * 1000;

  const handleSelectAnswer = async (quizId: string, selectedIndex: number, correctIndex: number) => {
    setAnswers(prev => ({ ...prev, [quizId]: selectedIndex }));
    await submitAnswer.mutateAsync({
      quizId,
      lessonId: lesson.id,
      selectedIndex,
      isCorrect: selectedIndex === correctIndex,
    });
  };

  const handleNextQuestion = () => {
    if (currentQ < quizzes.length - 1) {
      setCurrentQ(prev => prev + 1);
    } else {
      setQuizDone(true);
    }
  };

  const correctCount = quizzes.filter(q => answers[q.id] === q.correct_index).length;
  const passRate = quizzes.length > 0 ? correctCount / quizzes.length : 1;
  const passed = passRate >= 0.7;

  const handleComplete = async () => {
    const elapsed = Date.now() - startTime;
    if (elapsed < minTime) {
      toast.error(`Please spend at least ${Math.ceil((minTime - elapsed) / 1000)}s more reading`);
      return;
    }
    if (hasQuiz && !quizDone) {
      setQuizMode(true);
      return;
    }
    if (hasQuiz && !passed) {
      toast.error("You need 70% on the quiz to complete this lesson");
      return;
    }
    setCompleting(true);
    try {
      await completeLesson.mutateAsync(lesson.id);
      toast.success("Lesson completed! Wallet credited 🎓");
      onBack();
    } catch (err) {
      toast.error((err as Error).message || "Failed to complete");
    } finally {
      setCompleting(false);
    }
  };

  if (quizMode && !quizDone) {
    const q = quizzes[currentQ];
    const opts = (typeof q.options === 'string' ? JSON.parse(q.options) : q.options) as string[];
    const answered = answers[q.id] !== undefined;
    return (
      <div className="min-h-screen pb-24 px-5 pt-12">
        <button onClick={() => setQuizMode(false)} className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
          <ArrowLeft size={16} /> Back to lesson
        </button>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-muted-foreground font-semibold">Question {currentQ + 1}/{quizzes.length}</p>
          <Progress value={((currentQ + 1) / quizzes.length) * 100} className="h-1.5 w-24" />
        </div>
        <h2 className="text-lg font-bold mb-6">{q.question}</h2>
        <div className="space-y-3">
          {opts.map((opt: string, i: number) => {
            const selected = answers[q.id] === i;
            const isCorrect = i === q.correct_index;
            let classes = "glass-card rounded-2xl p-4 text-left w-full text-sm font-medium transition-all ";
            if (answered) {
              if (isCorrect) classes += "border-2 border-accent bg-accent/10 text-accent";
              else if (selected) classes += "border-2 border-destructive bg-destructive/10 text-destructive";
              else classes += "opacity-50";
            } else {
              classes += "hover:bg-foreground/5";
            }
            return (
              <button key={i} disabled={answered}
                onClick={() => handleSelectAnswer(q.id, i, q.correct_index)}
                className={classes}>
                <span className="mr-2 font-bold">{String.fromCharCode(65 + i)}.</span> {opt}
              </button>
            );
          })}
        </div>
        {answered && (
          <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mt-6">
            <ZappButton onClick={handleNextQuestion} className="w-full">
              {currentQ < quizzes.length - 1 ? "Next Question" : "See Results"}
            </ZappButton>
          </motion.div>
        )}
      </div>
    );
  }

  if (quizDone) {
    return (
      <div className="min-h-screen pb-24 px-5 pt-12">
        <div className="glass-card rounded-2xl p-8 text-center mt-12">
          <div className="text-5xl mb-4">{passed ? "🎉" : "😔"}</div>
          <h2 className="text-xl font-bold mb-2">{passed ? "Quiz Passed!" : "Not Quite"}</h2>
          <p className="text-sm text-muted-foreground mb-4">
            You got {correctCount}/{quizzes.length} correct ({Math.round(passRate * 100)}%)
          </p>
          {passed ? (
            <ZappButton onClick={handleComplete} loading={completing} className="w-full">
              Claim R{(Number(lesson.coin_reward) / 100).toFixed(2)} Reward
            </ZappButton>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">You need 70% to pass. Review the lesson and try again.</p>
              <ZappButton onClick={() => { setQuizMode(false); setQuizDone(false); setCurrentQ(0); setAnswers({}); }} className="w-full">
                Review Lesson
              </ZappButton>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 px-5 pt-12">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
        <ArrowLeft size={16} /> Back
      </button>
      <div className="mb-4">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-foreground/5 px-2 py-0.5 rounded-full">
          {lesson.category}
        </span>
        <h1 className="text-xl font-bold mt-2">{lesson.title}</h1>
        {lesson.description && <p className="text-sm text-muted-foreground mt-1">{lesson.description}</p>}
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Clock size={12} /> ~{Math.ceil((lesson.min_time_seconds || 30) / 60)} min</span>
          <span className="font-bold text-accent">R{(Number(lesson.coin_reward) / 100).toFixed(2)} reward</span>
          {hasQuiz && <span className="flex items-center gap-1"><Sparkles size={12} /> Quiz required</span>}
        </div>
      </div>

      {/* Content */}
      <div className="glass-card rounded-2xl p-5 mb-6 prose prose-sm prose-invert max-w-none">
        <MarkdownContent content={lesson.content_body || ""} />
      </div>

      {/* Action */}
      {completed ? (
        <div className="glass-card rounded-2xl p-4 flex items-center gap-3 bg-accent/10">
          <Check size={20} className="text-accent" />
          <p className="text-sm font-semibold text-accent">Lesson Completed ✓</p>
        </div>
      ) : (
        <ZappButton onClick={handleComplete} loading={completing} className="w-full">
          {hasQuiz ? "Take Quiz to Complete" : "Mark as Complete"}
        </ZappButton>
      )}
    </div>
  );
}

function MarkdownContent({ content }: { content: string }) {
  const lines = content.split('\n');
  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        if (line.startsWith('## ')) return <h2 key={i} className="text-lg font-bold mt-4 mb-2">{line.slice(3)}</h2>;
        if (line.startsWith('### ')) return <h3 key={i} className="text-base font-semibold mt-3 mb-1">{line.slice(4)}</h3>;
        if (line.startsWith('- **')) {
          const match = line.match(/- \*\*(.+?)\*\* — (.+)/);
          if (match) return <p key={i} className="text-sm"><strong>{match[1]}</strong> — {match[2]}</p>;
        }
        if (line.startsWith('- ')) return <p key={i} className="text-sm pl-3">• {line.slice(2)}</p>;
        if (line.startsWith('| ') && !line.includes('---')) {
          const cells = line.split('|').filter(Boolean).map(c => c.trim());
          return <div key={i} className="flex justify-between text-sm"><span>{cells[0]}</span><span className="font-semibold">{cells[1]}</span></div>;
        }
        if (line.startsWith('1. ') || line.match(/^\d+\. /)) {
          const num = line.match(/^(\d+)\. (.+)/);
          if (num) return <p key={i} className="text-sm pl-3"><strong>{num[1]}.</strong> {num[2]}</p>;
        }
        if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="text-sm font-bold mt-2">{line.slice(2, -2)}</p>;
        if (line.trim() === '') return <div key={i} className="h-1" />;
        return <p key={i} className="text-sm">{line.replace(/\*\*(.+?)\*\*/g, '$1')}</p>;
      })}
    </div>
  );
}
