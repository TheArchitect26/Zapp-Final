/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, ToggleLeft, ToggleRight, Pencil, Trash2, ChevronUp, ChevronDown, X, HelpCircle, Loader2, Save } from "lucide-react";
import ZappButton from "@/components/ZappButton";
import { toast } from "sonner";

export default function AcademyTab() {
  const qc = useQueryClient();
  const [editingLesson, setEditingLesson] = useState<any | null>(null);
  const [quizFor, setQuizFor] = useState<any | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data: lessons = [], isLoading } = useQuery({
    queryKey: ["admin_academy_lessons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("academy_lessons")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin_academy_lessons"] });
    qc.invalidateQueries({ queryKey: ["academy_lessons"] });
  };

  const toggleStatus = useMutation({
    mutationFn: async (l: any) => {
      const { error } = await supabase
        .from("academy_lessons")
        .update({ status: l.status === "active" ? "inactive" : "active" })
        .eq("id", l.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteLesson = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("academy_lessons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Lesson deleted");
    },
  });

  const reorder = useMutation({
    mutationFn: async ({ id, dir }: { id: string; dir: "up" | "down" }) => {
      const idx = lessons.findIndex((l: any) => l.id === id);
      const swapIdx = dir === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= lessons.length) return;
      const a = lessons[idx];
      const b = lessons[swapIdx];
      await supabase.from("academy_lessons").update({ sort_order: b.sort_order }).eq("id", a.id);
      await supabase.from("academy_lessons").update({ sort_order: a.sort_order }).eq("id", b.id);
    },
    onSuccess: invalidate,
  });

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-3">
      <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 text-sm font-semibold text-primary">
        <Plus size={16} /> New Lesson
      </button>

      {lessons.map((l: any, i: number) => (
        <div key={l.id} className="glass-card rounded-2xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-muted-foreground">#{i + 1}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-foreground/10 capitalize">{l.category}</span>
                {l.has_quiz && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">Quiz</span>}
              </div>
              <p className="font-bold text-sm truncate">{l.title}</p>
              <p className="text-xs text-muted-foreground line-clamp-1">{l.description}</p>
              <p className="text-xs text-accent mt-1">R{Number(l.coin_reward).toFixed(2)} · {l.min_time_seconds}s min</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <button onClick={() => toggleStatus.mutate(l)}>
                {l.status === "active" ? <ToggleRight size={26} className="text-accent" /> : <ToggleLeft size={26} className="text-muted-foreground" />}
              </button>
              <div className="flex gap-1">
                <button onClick={() => reorder.mutate({ id: l.id, dir: "up" })} disabled={i === 0} className="p-1 disabled:opacity-30"><ChevronUp size={14} /></button>
                <button onClick={() => reorder.mutate({ id: l.id, dir: "down" })} disabled={i === lessons.length - 1} className="p-1 disabled:opacity-30"><ChevronDown size={14} /></button>
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-3 pt-3 border-t border-foreground/5">
            <button onClick={() => setEditingLesson(l)} className="flex-1 flex items-center justify-center gap-1 h-8 rounded-lg bg-foreground/5 text-xs font-semibold">
              <Pencil size={12} /> Edit
            </button>
            <button onClick={() => setQuizFor(l)} className="flex-1 flex items-center justify-center gap-1 h-8 rounded-lg bg-foreground/5 text-xs font-semibold">
              <HelpCircle size={12} /> Quiz
            </button>
            <button onClick={() => { if (confirm("Delete this lesson?")) deleteLesson.mutate(l.id); }} className="px-3 h-8 rounded-lg bg-destructive/10 text-destructive">
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      ))}

      {showCreate && <LessonEditor lesson={null} onClose={() => { setShowCreate(false); invalidate(); }} maxOrder={lessons.length} />}
      {editingLesson && <LessonEditor lesson={editingLesson} onClose={() => { setEditingLesson(null); invalidate(); }} />}
      {quizFor && <QuizEditor lesson={quizFor} onClose={() => setQuizFor(null)} />}
    </div>
  );
}

function LessonEditor({ lesson, onClose, maxOrder = 0 }: { lesson: any | null; onClose: () => void; maxOrder?: number }) {
  const [form, setForm] = useState({
    title: lesson?.title ?? "",
    description: lesson?.description ?? "",
    category: lesson?.category ?? "basics",
    content_body: lesson?.content_body ?? "",
    coin_reward: lesson?.coin_reward ?? 1,
    min_time_seconds: lesson?.min_time_seconds ?? 30,
    has_quiz: lesson?.has_quiz ?? false,
    quiz_pass_required: lesson?.quiz_pass_required ?? false,
    sort_order: lesson?.sort_order ?? maxOrder,
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.title) { toast.error("Title required"); return; }
    setSaving(true);
    try {
      if (lesson) {
        const { error } = await supabase.from("academy_lessons").update(form).eq("id", lesson.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("academy_lessons").insert(form);
        if (error) throw error;
      }
      toast.success(lesson ? "Updated" : "Created");
      onClose();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-card border border-foreground/10 rounded-t-3xl md:rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-card flex items-center justify-between p-4 border-b border-foreground/5">
          <h2 className="font-bold">{lesson ? "Edit Lesson" : "New Lesson"}</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="p-4 space-y-3">
          <Field label="Title">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input-base" />
          </Field>
          <Field label="Description">
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="input-base" />
          </Field>
          <Field label="Category">
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input-base">
              <option value="basics">Getting Started</option>
              <option value="surveys">Surveys Mastery</option>
              <option value="earn_faster">Earn Faster</option>
              <option value="referrals">Referrals & Growth</option>
              <option value="withdraw">Withdraw & Use Money</option>
            </select>
          </Field>
          <Field label="Content (Markdown)">
            <textarea value={form.content_body} onChange={(e) => setForm({ ...form, content_body: e.target.value })} rows={8} className="input-base font-mono text-xs" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Reward (R)">
              <input type="number" step="0.50" value={form.coin_reward} onChange={(e) => setForm({ ...form, coin_reward: Number(e.target.value) })} className="input-base" />
            </Field>
            <Field label="Min time (s)">
              <input type="number" value={form.min_time_seconds} onChange={(e) => setForm({ ...form, min_time_seconds: Number(e.target.value) })} className="input-base" />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.has_quiz} onChange={(e) => setForm({ ...form, has_quiz: e.target.checked })} />
            Has quiz
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.quiz_pass_required} onChange={(e) => setForm({ ...form, quiz_pass_required: e.target.checked })} />
            Quiz pass required (70%)
          </label>
          <ZappButton onClick={save} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" size={16} /> : <><Save size={16} /> Save</>}
          </ZappButton>
        </div>
      </div>
      <style>{`.input-base { width: 100%; min-height: 40px; background: hsl(var(--foreground) / 0.05); border-radius: 10px; padding: 8px 12px; font-size: 14px; color: hsl(var(--foreground)); border: none; outline: none; }`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">{label}</label>
      {children}
    </div>
  );
}

function QuizEditor({ lesson, onClose }: { lesson: any; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: quizzes = [], isLoading } = useQuery({
    queryKey: ["admin_quizzes", lesson.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("academy_quizzes")
        .select("*")
        .eq("lesson_id", lesson.id)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ question: "", options: ["", "", ""], correct_index: 0 });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin_quizzes", lesson.id] });

  const addQuiz = async () => {
    if (!form.question || form.options.some((o) => !o)) { toast.error("Fill all fields"); return; }
    const { error } = await supabase.from("academy_quizzes").insert({
      lesson_id: lesson.id,
      question: form.question,
      options: form.options,
      correct_index: form.correct_index,
      sort_order: quizzes.length,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Question added");
    setForm({ question: "", options: ["", "", ""], correct_index: 0 });
    setAdding(false);
    refresh();
  };

  const removeQuiz = async (id: string) => {
    if (!confirm("Delete question?")) return;
    const { error } = await supabase.from("academy_quizzes").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    refresh();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-card border border-foreground/10 rounded-t-3xl md:rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-card flex items-center justify-between p-4 border-b border-foreground/5">
          <div>
            <h2 className="font-bold">Quiz · {lesson.title}</h2>
            <p className="text-xs text-muted-foreground">{quizzes.length} questions</p>
          </div>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="p-4 space-y-3">
          {isLoading ? <Loader2 className="animate-spin mx-auto" /> : quizzes.map((q: any, i: number) => (
            <div key={q.id} className="glass-card rounded-xl p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-sm flex-1">{i + 1}. {q.question}</p>
                <button onClick={() => removeQuiz(q.id)} className="text-destructive"><Trash2 size={14} /></button>
              </div>
              <ul className="mt-2 space-y-1 text-xs">
                {(q.options as string[]).map((o, idx) => (
                  <li key={idx} className={idx === q.correct_index ? "text-accent font-semibold" : "text-muted-foreground"}>
                    {idx === q.correct_index ? "✓" : "·"} {o}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {adding ? (
            <div className="glass-card rounded-xl p-3 space-y-2">
              <input value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} placeholder="Question" className="input-base" />
              {form.options.map((o, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={form.correct_index === idx}
                    onChange={() => setForm({ ...form, correct_index: idx })}
                  />
                  <input
                    value={o}
                    onChange={(e) => {
                      const next = [...form.options];
                      next[idx] = e.target.value;
                      setForm({ ...form, options: next });
                    }}
                    placeholder={`Option ${idx + 1}`}
                    className="input-base flex-1"
                  />
                </div>
              ))}
              <button onClick={() => setForm({ ...form, options: [...form.options, ""] })} className="text-xs text-primary font-semibold">+ Add option</button>
              <ZappButton onClick={addQuiz}>Save Question</ZappButton>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} className="w-full h-10 rounded-xl border border-dashed border-foreground/20 text-sm font-semibold flex items-center justify-center gap-2">
              <Plus size={16} /> Add Question
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
