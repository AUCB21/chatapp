"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { useSessionStore } from "@/store/sessionStore";
import type { RealtimeChannel } from "@supabase/supabase-js";

// --- Types ---

export interface PresenceUser {
  id: string;
  email: string;
  isTyping: boolean;
  lastSeen: string; // ISO timestamp
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

  const channelRef = useRef<RealtimeChannel | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);

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
            });
          }
        }

        setOnlineUsers(users);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          // Track this user's presence
          await channel.track({
            id: user.id,
            email: user.email || "Unknown",
            isTyping: false,
            lastSeen: new Date().toISOString(),
          });
          console.log(`[Presence] ${chatId}: tracking`);
        }
      });

    channelRef.current = channel;

    return () => {
      channel.untrack();
      channel.unsubscribe();
      channelRef.current = null;
      setOnlineUsers([]);
    };
  }, [isReady, chatId, user]);

  const startTyping = useCallback(() => {
    if (!channelRef.current || !user) return;

    channelRef.current.track({
      id: user.id,
      email: user.email || "Unknown",
      isTyping: true,
      lastSeen: new Date().toISOString(),
    });

    // Auto-stop typing after timeout
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      if (channelRef.current && user) {
        channelRef.current.track({
          id: user.id,
          email: user.email || "Unknown",
          isTyping: false,
          lastSeen: new Date().toISOString(),
        });
      }
    }, TYPING_TIMEOUT);
  }, [user]);

  const stopTyping = useCallback(() => {
    if (!channelRef.current || !user) return;
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);

    channelRef.current.track({
      id: user.id,
      email: user.email || "Unknown",
      isTyping: false,
      lastSeen: new Date().toISOString(),
    });
  }, [user]);

  const typingUsers = onlineUsers.filter((u) => u.isTyping);

  return { onlineUsers, typingUsers, startTyping, stopTyping };
}
