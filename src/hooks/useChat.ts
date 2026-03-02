"use client";

import { useEffect, useCallback, useRef } from "react";
import { useChatStore, selectActiveMessages } from "@/store/chatStore";
import type { ChatState } from "@/store/chatStore";
import { supabase } from "@/lib/supabaseClient";
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
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  // --- Fetch messages + subscribe to Realtime when active chat changes ---
  // Also re-runs when the user accepts a pending invitation (role changes).

  useEffect(() => {
    if (!activeChatId) return;

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

      console.log('[Realtime] Setting up channel for chat:', activeChatId);
      
      const channel = supabase
        .channel(`messages:${activeChatId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `chat_id=eq.${activeChatId}`,
          },
          (payload) => {
            console.log('[Realtime] ✅ MESSAGE RECEIVED!', payload);
            console.log('[Realtime] Payload details:', {
              eventType: payload.eventType,
              schema: payload.schema,
              table: payload.table,
              new: payload.new,
            });
            // Realtime delivers raw Postgres rows (snake_case), not Drizzle-mapped camelCase.
            const raw = payload.new as Record<string, unknown>;
            const incoming: Message = {
              id: raw.id as string,
              chatId: raw.chat_id as string,
              userId: raw.user_id as string,
              content: raw.content as string,
              createdAt: new Date(raw.created_at as string),
            };
            console.log('[Realtime] Appending message:', incoming.content);
            appendMessage(activeChatId!, incoming);
          }
        )
        .subscribe((status, err) => {
          console.log(`[Realtime] Messages channel status →`, status);
          if (err) {
            console.error(`[Realtime] ❌ Subscription error:`, err);
          }
          if (status === 'SUBSCRIBED') {
            console.log('[Realtime] ✅ Successfully subscribed to messages');
            // Log channel state
            console.log('[Realtime] Channel state:', channel.state);
          }
        });

      channelRef.current = channel;
    }

    fetchAndSubscribe();

    return () => {
      channelRef.current?.unsubscribe();
      channelRef.current = null;
    };
  }, [activeChatId, activeMembership]);

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
