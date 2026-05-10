import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useAcademyLessons() {
  const { data: lessons = [], isLoading } = useQuery({
    queryKey: ["academy_lessons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("academy_lessons")
        .select("*")
        .eq("status", "active")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Preserve category order from sort_order
  const seen = new Set<string>();
  const categories: string[] = [];
  for (const l of lessons) {
    if (!seen.has(l.category)) {
      seen.add(l.category);
      categories.push(l.category);
    }
  }
  return { lessons, categories, isLoading };
}

export function useLessonCompletions() {
  const { user } = useAuth();

  const { data: completions = [] } = useQuery({
    queryKey: ["lesson_completions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lesson_completions")
        .select("*")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const completedIds = new Set(completions.map((c) => c.lesson_id));
  return { completions, completedIds };
}

export function useCompleteLesson() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (lessonId: string) => {
      const { authedFetch } = await import("@/lib/api");
      const res = await authedFetch("/api/v1/earn/academy/complete", {
        method: "POST",
        body: JSON.stringify({ lesson_id: lessonId }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lesson_completions", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["wallet", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["transactions", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["feed_events"] });
    },
  });
}

export function useAcademyQuizzes(lessonId: string) {
  const { data: quizzes = [], isLoading } = useQuery({
    queryKey: ["academy_quizzes", lessonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("academy_quizzes")
        .select("*")
        .eq("lesson_id", lessonId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!lessonId,
  });

  return { quizzes, isLoading };
}

export function useSubmitQuizAnswer() {
  return useMutation({
    mutationFn: async ({
      quizId,
      lessonId,
      selectedIndex,
    }: {
      quizId: string;
      lessonId: string;
      selectedIndex: number;
    }) => {
      const { authedFetch } = await import("@/lib/api");
      const res = await authedFetch("/api/v1/earn/academy/quiz-answer", {
        method: "POST",
        body: JSON.stringify({ quiz_id: quizId, lesson_id: lessonId, selected_index: selectedIndex }),
      });
      return res.json() as Promise<{ success: boolean; is_correct: boolean }>;
    },
  });
}
