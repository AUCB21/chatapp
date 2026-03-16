"use client";

import { useEffect, useState, useRef } from "react";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { useSessionStore } from "@/store/sessionStore";
import { useChatStore, type ChatWithRole } from "@/store/chatStore";
import { useProfileStore } from "@/store/profileStore";
import type { Message, Reaction, UserProfile } from "@/db/schema";

interface BootState {
  ready: boolean;
  progress: number;
  label: string;
}

// Normalize JSON date strings → Date objects (matches useChat normalizeMessages)
type MessagePayload = Omit<Message, "createdAt" | "editedAt" | "deletedAt"> & {
  createdAt: string | Date;
  editedAt: string | Date | null;
  deletedAt: string | Date | null;
};

function normalizeMessage(m: MessagePayload): Message {
  const toDate = (v: string | Date | null) =>
    v ? (v instanceof Date ? v : new Date(v as string)) : null;
  return {
    ...m,
    createdAt: m.createdAt instanceof Date ? m.createdAt : new Date(m.createdAt as string),
    editedAt: toDate(m.editedAt),
    deletedAt: toDate(m.deletedAt),
  };
}

export function useBootLoader(): BootState {
  const isReady = useSupabaseAuth();
  const userId = useSessionStore((s) => s.user?.id ?? null);
  const booted = useChatStore((s) => s.booted);
  const [state, setState] = useState<BootState>(
    booted
      ? { ready: true, progress: 100, label: "" }
      : { ready: false, progress: 0, label: "Connecting..." }
  );
  const bootedRef = useRef(false);

  useEffect(() => {
    if (bootedRef.current || booted) return;
    if (!isReady || !userId) return;

    bootedRef.current = true;
    let cancelled = false;

    async function boot() {
      const store = useChatStore.getState();

      // Step 0 — Fetch user profile (colors, status, display name)
      setState({ ready: false, progress: 10, label: "Loading profile..." });
      try {
        const res = await fetch("/api/user/profile");
        if (!cancelled && res.ok) {
          const { data } = await res.json();
          if (data.profile) {
            const p = data.profile as UserProfile;
            // Normalize dates from JSON
            useProfileStore.getState().setProfile({
              ...p,
              createdAt: new Date(p.createdAt),
              updatedAt: new Date(p.updatedAt),
            });
          }
        }
      } catch {
        // Non-fatal — defaults will be used
      }

      if (cancelled) return;

      // Step 1 — Fetch chats + unread counts
      setState({ ready: false, progress: 25, label: "Loading chats..." });
      let chats: ChatWithRole[] = [];
      try {
        const res = await fetch("/api/chat");
        if (!cancelled && res.ok) {
          const { data } = await res.json();
          chats = data.chats ?? data;
          store.setChats(chats);
          if (data.unreadCounts) store.setUnreadCounts(data.unreadCounts);
        }
      } catch {
        // Non-fatal — useChat will retry on mount
      }

      if (cancelled) return;

      // Step 2 — Sync pending deleted-for-me IDs from localStorage
      setState({ ready: false, progress: 45, label: "Syncing data..." });
      try {
        const storageKey = `deleted-for-me-${userId}`;
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const pendingIds: string[] = JSON.parse(stored).filter(
            (v: unknown): v is string => typeof v === "string"
          );
          if (pendingIds.length > 0) {
            const res = await fetch("/api/chat/deleted-for-me", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ messageIds: pendingIds }),
            });
            if (!cancelled && res.ok) {
              localStorage.removeItem(storageKey);
            }
          }
        }
      } catch {
        // Non-fatal — localStorage fallback is kept
      }

      if (cancelled) return;

      // Step 3 — Preload first page of messages for all non-pending chats
      const activeChats = chats.filter(
        (c) => c.role !== "pending" && c.role !== "declined"
      );

      if (activeChats.length > 0) {
        setState({ ready: false, progress: 60, label: "Loading messages..." });

        // Fetch all chats in parallel
        const results = await Promise.allSettled(
          activeChats.map((chat) =>
            fetch(`/api/chat/${chat.id}/messages`)
              .then((r) => (r.ok ? r.json() : null))
              .then((json) => (json ? { chatId: chat.id, data: json.data } : null))
          )
        );

        if (cancelled) return;

        const { setMessages, setReactions, setAttachments, setHasMore } = useChatStore.getState();
        for (const result of results) {
          if (result.status !== "fulfilled" || !result.value) continue;
          const { chatId, data } = result.value as {
            chatId: string;
            data: { messages?: MessagePayload[]; reactions?: Reaction[]; hasMore?: boolean; attachments?: Record<string, unknown[]> };
          };
          if (data.messages) {
            setMessages(chatId, data.messages.map(normalizeMessage));
            setReactions(chatId, data.reactions ?? []);
            if (data.attachments) setAttachments(chatId, data.attachments as Record<string, import("@/store/chatStore").AttachmentWithUrl[]>);
            setHasMore(chatId, data.hasMore ?? false);
          }
        }
      }

      if (cancelled) return;

      // Step 4 — Preload starred message IDs + blocked user IDs
      setState({ ready: false, progress: 90, label: "Loading preferences..." });
      try {
        const [starredRes, blockedRes] = await Promise.allSettled([
          fetch("/api/starred").then((r) => r.ok ? r.json() : null),
          fetch("/api/block").then((r) => r.ok ? r.json() : null),
        ]);
        const { setStarredMessageIds, setBlockedUserIds } = useChatStore.getState();
        if (starredRes.status === "fulfilled" && starredRes.value?.data) {
          setStarredMessageIds(new Set(starredRes.value.data.map((m: { messageId: string }) => m.messageId)));
        }
        if (blockedRes.status === "fulfilled" && blockedRes.value?.data) {
          setBlockedUserIds(new Set(blockedRes.value.data as string[]));
        }
      } catch {
        // Non-fatal
      }

      if (cancelled) return;

      // Done
      setState({ ready: false, progress: 100, label: "Almost ready..." });
      await new Promise((r) => setTimeout(r, 300));

      if (cancelled) return;

      useChatStore.getState().setBooted(true);
      setState({ ready: true, progress: 100, label: "" });
    }

    boot();

    return () => {
      cancelled = true;
    };
  }, [isReady, userId, booted]);

  return state;
}
