"use client";

import { useEffect, useCallback, useRef } from "react";
import { useChatStore, selectActiveMessages } from "@/store/chatStore";
import type { ChatState } from "@/store/chatStore";
import { supabase } from "@/lib/supabaseClient";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import type { Message } from "@/db/schema";
import type { RealtimeChannel } from "@supabase/supabase-js";

// --- Types ---

interface UseChatReturn {
  // State
  chats: ChatState["chats"];
  messages: Message[];
  activeChatId: string | null;
  canWrite: boolean;
  loading: ChatState["loading"];
  error: ChatState["error"];

  // Actions
  setActiveChat: (chatId: string) => void;
  sendMessage: (content: string) => Promise<void>;
  refreshChats: () => Promise<void>;
  joinChat: (chatId: string) => Promise<void>;
  declineChat: (chatId: string) => Promise<void>;
}

// --- Hook ---

export function useChat(): UseChatReturn {
  const isReady = useSupabaseAuth();

  const {
    chats,
    activeChatId,
    loading,
    error,
    setChats,
    setActiveChat: _setActiveChat,
    setMessages,
    appendMessage,
    removeMembership,
    setLoading,
    setError,
  } = useChatStore();

  const messages = useChatStore(selectActiveMessages);

  const canWriteSelector = useCallback(
    (state: ChatState) =>
      activeChatId !== null &&
      (state.memberships[activeChatId] === "write" ||
        state.memberships[activeChatId] === "admin"),
    [activeChatId]
  );
  const canWrite = useChatStore(canWriteSelector);

  // Reactive membership for the active chat — drives the message-fetch effect
  const activeMembershipSelector = useCallback(
    (state: ChatState) =>
      activeChatId ? (state.memberships[activeChatId] ?? null) : null,
    [activeChatId]
  );
  const activeMembership = useChatStore(activeMembershipSelector);

  const channelRef = useRef<RealtimeChannel | null>(null);

  // --- Fetch all accessible chats on mount ---

  const refreshChats = useCallback(async () => {
    setLoading("chats", true);
    setError("chats", null);

    try {
      const res = await fetch("/api/chat");
      if (!res.ok) throw new Error("Failed to fetch chats");
      const { data } = await res.json();
      setChats(data);
    } catch (e) {
      setError("chats", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading("chats", false);
    }
  }, []);

  useEffect(() => {
    refreshChats();
  }, []);

  // --- Refresh chat list on relevant DB changes ---
  // • chats:INSERT        — a new chat was created
  // • memberships:INSERT  — an invitee accepted (creator's client updates)
  // • invitations:INSERT  — you were invited (your client sees the pending chat)
  // Requires Realtime to be enabled on all three tables in Supabase.

  useEffect(() => {
    if (!isReady) return;

    const channel = supabase
      .channel("chat-list-changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chats" },
        () => { refreshChats(); }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "memberships" },
        () => { refreshChats(); }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "invitations" },
        () => { refreshChats(); }
      )
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          console.log("[Realtime] chat-list-changes: subscribed");
        } else if (status === "CHANNEL_ERROR") {
          console.error("[Realtime] chat-list-changes error:", err);
        } else if (status === "TIMED_OUT") {
          console.warn("[Realtime] chat-list-changes timed out");
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [isReady]);

  // --- Fetch messages + subscribe to Realtime when active chat changes ---
  // Also re-runs when the user accepts a pending invitation (role changes).

  useEffect(() => {
    if (!isReady || !activeChatId) return;

    // Pending chats show an accept/decline prompt — no messages to load
    if (activeMembership === "pending") return;

    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }

    async function fetchAndSubscribe() {
      setLoading("messages", true);
      setError("messages", null);

      try {
        const res = await fetch(`/api/chat/${activeChatId}/messages`);

        if (res.status === 403) {
          _setActiveChat(null as unknown as string);
          return;
        }

        if (!res.ok) throw new Error("Failed to fetch messages");

        const { data } = await res.json();
        setMessages(activeChatId!, data);
      } catch (e) {
        setError("messages", e instanceof Error ? e.message : "Unknown error");
        return;
      } finally {
        setLoading("messages", false);
      }

      const channel = supabase
        .channel(`messages:${activeChatId}`)
        // Primary: postgres_changes (depends on publication + RLS + token)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `chat_id=eq.${activeChatId}`,
          },
          (payload) => {
            console.log("[Realtime] postgres_changes message:", payload.new);
            const raw = payload.new as Record<string, unknown>;
            const incoming: Message = {
              id: raw.id as string,
              chatId: raw.chat_id as string,
              userId: raw.user_id as string,
              content: raw.content as string,
              createdAt: new Date(raw.created_at as string),
            };
            appendMessage(activeChatId!, incoming);
          }
        )
        // Fallback: broadcast (direct WebSocket, no publication/RLS needed)
        .on(
          "broadcast",
          { event: "new-message" },
          (payload) => {
            console.log("[Realtime] broadcast message:", payload.payload);
            const msg = payload.payload as Message;
            appendMessage(activeChatId!, {
              ...msg,
              createdAt: new Date(msg.createdAt),
            });
          }
        )
        .subscribe((status, err) => {
          if (status === "SUBSCRIBED") {
            console.log(`[Realtime] messages:${activeChatId}: subscribed`);
          } else if (status === "CHANNEL_ERROR") {
            console.error(`[Realtime] messages:${activeChatId} error:`, err);
          } else if (status === "TIMED_OUT") {
            console.warn(`[Realtime] messages:${activeChatId} timed out`);
          }
        });

      channelRef.current = channel;
    }

    fetchAndSubscribe();

    return () => {
      channelRef.current?.unsubscribe();
      channelRef.current = null;
    };
  }, [isReady, activeChatId, activeMembership]);

  // --- Send message with optimistic update ---

  const sendMessage = useCallback(
    async (content: string) => {
      if (!activeChatId || !canWrite || !content.trim()) return;

      const optimisticMsg: Message = {
        id: `optimistic-${Date.now()}`,
        chatId: activeChatId,
        userId: "optimistic",
        content: content.trim(),
        createdAt: new Date(),
      };

      appendMessage(activeChatId, optimisticMsg);

      try {
        const res = await fetch(`/api/chat/${activeChatId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: content.trim() }),
        });

        if (!res.ok) throw new Error("Failed to send message");

        const { data: savedMsg } = await res.json();

        // Replace optimistic entry with the real saved message.
        // If Realtime fires too, appendMessage will deduplicate by ID.
        setMessages(
          activeChatId,
          useChatStore
            .getState()
            .messages[activeChatId].map((m) =>
              m.id === optimisticMsg.id ? savedMsg : m
            )
        );

        // Broadcast to other clients on the same channel.
        // This is the reliable delivery path — does not depend on
        // postgres_changes publication or RLS evaluation.
        channelRef.current?.send({
          type: "broadcast",
          event: "new-message",
          payload: savedMsg,
        });
      } catch {
        // On failure, remove the optimistic entry.
        setMessages(
          activeChatId,
          useChatStore
            .getState()
            .messages[activeChatId].filter((m) => m.id !== optimisticMsg.id)
        );
      }
    },
    [activeChatId, canWrite]
  );

  // --- Accept a pending invitation ---
  // After joining, refreshChats() updates the role from "pending" to "write",
  // which changes activeMembership and automatically triggers the message fetch.

  const joinChat = useCallback(
    async (chatId: string): Promise<void> => {
      const res = await fetch(`/api/chat/${chatId}/join`, { method: "POST" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Failed to accept invitation");
      }
      await refreshChats();
    },
    [refreshChats]
  );

  // --- Decline a pending invitation ---

  const declineChat = useCallback(
    async (chatId: string): Promise<void> => {
      const res = await fetch(`/api/chat/${chatId}/join`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Failed to decline invitation");
      }
      removeMembership(chatId);
    },
    [removeMembership]
  );

  const setActiveChat = useCallback((chatId: string) => {
    _setActiveChat(chatId);
  }, []);

  return {
    chats,
    messages,
    activeChatId,
    canWrite,
    loading,
    error,
    setActiveChat,
    sendMessage,
    refreshChats,
    joinChat,
    declineChat,
  };
}
