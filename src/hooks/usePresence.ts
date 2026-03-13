"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { useSessionStore } from "@/store/sessionStore";
import { useProfileStore } from "@/store/profileStore";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { UserStatus } from "@/db/schema";

// --- Types ---

export interface PresenceUser {
  id: string;
  email: string;
  isTyping: boolean;
  lastSeen: string; // ISO timestamp
  status?: UserStatus;
  displayName?: string;
}

interface UsePresenceReturn {
  /** Other users currently online in this chat */
  onlineUsers: PresenceUser[];
  /** Users currently typing (excludes self) */
  typingUsers: PresenceUser[];
  /** Broadcast that this user is typing */
  startTyping: () => void;
  /** Broadcast that this user stopped typing */
  stopTyping: () => void;
}

// Debounce typing timeout (ms)
const TYPING_TIMEOUT = 3000;

// --- Hook ---

export function usePresence(chatId: string | null): UsePresenceReturn {
  const isReady = useSupabaseAuth();
  const user = useSessionStore((s) => s.user);
  const profile = useProfileStore((s) => s.profile);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);

  /** Build presence payload with current profile data */
  const getPresencePayload = useCallback(
    (isTyping: boolean) => ({
      id: user?.id ?? "",
      email: user?.email || "Unknown",
      isTyping,
      lastSeen: new Date().toISOString(),
      status: profile?.status ?? ("online" as UserStatus),
      displayName: profile?.displayName ?? user?.email?.split("@")[0] ?? "Unknown",
    }),
    [user, profile?.status, profile?.displayName]
  );

  // Track and sync presence
  useEffect(() => {
    if (!isReady || !chatId || !user) return;

    const channel = supabase.channel(`presence:${chatId}`, {
      config: { presence: { key: user.id } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceUser>();
        const users: PresenceUser[] = [];

        for (const [userId, presences] of Object.entries(state)) {
          if (userId === user.id) continue; // exclude self
          const latest = presences[presences.length - 1];
          if (latest) {
            users.push({
              id: userId,
              email: latest.email || "Unknown",
              isTyping: latest.isTyping || false,
              lastSeen: latest.lastSeen || new Date().toISOString(),
              status: latest.status,
              displayName: latest.displayName,
            });
          }
        }

        setOnlineUsers(users);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track(getPresencePayload(false));
        }
      });

    channelRef.current = channel;

    return () => {
      channel.untrack();
      channel.unsubscribe();
      channelRef.current = null;
      setOnlineUsers([]);
    };
  }, [isReady, chatId, user, getPresencePayload]);

  const startTyping = useCallback(() => {
    if (!channelRef.current || !user) return;

    channelRef.current.track(getPresencePayload(true));

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      if (channelRef.current && user) {
        channelRef.current.track(getPresencePayload(false));
      }
    }, TYPING_TIMEOUT);
  }, [user, getPresencePayload]);

  const stopTyping = useCallback(() => {
    if (!channelRef.current || !user) return;
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);

    channelRef.current.track(getPresencePayload(false));
  }, [user, getPresencePayload]);

  const typingUsers = onlineUsers.filter((u) => u.isTyping);

  return { onlineUsers, typingUsers, startTyping, stopTyping };
}
