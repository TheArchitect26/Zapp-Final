import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

export function useFeedEvents() {
  const queryClient = useQueryClient();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["feed_events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feed_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("feed_realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "feed_events" }, () => {
        queryClient.invalidateQueries({ queryKey: ["feed_events"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return { events, isLoading };
}

export function useFeedProfiles(userIds: string[]) {
  const uniqueIds = [...new Set(userIds)];

  const { data: profiles = [] } = useQuery({
    queryKey: ["feed_profiles", uniqueIds.sort().join(",")],
    queryFn: async () => {
      if (uniqueIds.length === 0) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, username, full_name, avatar_url")
        .in("user_id", uniqueIds);
      if (error) throw error;
      return data;
    },
    enabled: uniqueIds.length > 0,
  });

  const profileMap = new Map(profiles.map((p) => [p.user_id, p]));
  return profileMap;
}

export function useFeedLikes(eventIds: string[]) {
  const { user } = useAuth();

  const { data: likes = [] } = useQuery({
    queryKey: ["feed_likes", eventIds.sort().join(",")],
    queryFn: async () => {
      if (eventIds.length === 0) return [];
      const { data, error } = await supabase
        .from("feed_likes")
        .select("*")
        .in("event_id", eventIds);
      if (error) throw error;
      return data;
    },
    enabled: eventIds.length > 0,
  });

  const likeCounts = new Map<string, number>();
  const userLikes = new Set<string>();
  likes.forEach((l) => {
    likeCounts.set(l.event_id, (likeCounts.get(l.event_id) || 0) + 1);
    if (l.user_id === user?.id) userLikes.add(l.event_id);
  });

  return { likeCounts, userLikes };
}

export function useToggleLike() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId, liked }: { eventId: string; liked: boolean }) => {
      if (liked) {
        const { error } = await supabase
          .from("feed_likes")
          .delete()
          .eq("user_id", user!.id)
          .eq("event_id", eventId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("feed_likes")
          .insert({ user_id: user!.id, event_id: eventId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed_likes"] });
    },
  });
}

export function useFeedVisibility() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ["feed_visibility", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feed_visibility_settings")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: { show_activity?: boolean; show_amounts?: boolean; anonymous_mode?: boolean }) => {
      if (settings) {
        const { error } = await supabase
          .from("feed_visibility_settings")
          .update(updates)
          .eq("user_id", user!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("feed_visibility_settings")
          .insert({ user_id: user!.id, ...updates });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed_visibility", user?.id] });
    },
  });

  return {
    settings: settings || { show_activity: true, show_amounts: false, anonymous_mode: false },
    updateVisibility: updateMutation.mutateAsync,
  };
}
