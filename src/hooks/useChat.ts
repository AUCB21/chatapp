"use client";

import { useEffect, useCallback, useRef } from "react";
import { useChatStore, selectActiveMessages, selectActiveReactions } from "@/store/chatStore";
import type { ChatState } from "@/store/chatStore";
import { supabase } from "@/lib/supabaseClient";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { useSessionStore } from "@/store/sessionStore";
import type { Message, Reaction } from "@/db/schema";
import type { RealtimeChannel } from "@supabase/supabase-js";

// --- Types ---

interface UseChatReturn {
  // State
  chats: ChatState["chats"];
  messages: Message[];
  reactions: Reaction[];
  activeChatId: string | null;
  canWrite: boolean;
  loading: ChatState["loading"];
  error: ChatState["error"];

  // Actions
  setActiveChat: (chatId: string) => void;
  sendMessage: (content: string, parentId?: string) => Promise<void>;
  editMessage: (messageId: string, content: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
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
    updateMessage,
    setReactions,
    addReaction: addReactionToStore,
    removeReaction: removeReactionFromStore,
    removeMembership,
    setLoading,
    setError,
  } = useChatStore();

  const messages = useChatStore(selectActiveMessages);
  const reactions = useChatStore(selectActiveReactions);

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
          console.warn("[Realtime] chat-list-changes: channel error (will retry)", err ?? "");
        } else if (status === "TIMED_OUT") {
          console.warn("[Realtime] chat-list-changes: timed out (will retry)");
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
        // API now returns { messages, reactions }
        if (data.messages) {
          setMessages(activeChatId!, data.messages);
          setReactions(activeChatId!, data.reactions ?? []);
        } else {
          // Fallback for old API format (array of messages)
          setMessages(activeChatId!, data);
        }
      } catch (e) {
        setError("messages", e instanceof Error ? e.message : "Unknown error");
        return;
      } finally {
        setLoading("messages", false);
      }

      const channel = supabase
        .channel(`messages:${activeChatId}`)
        // INSERT: new messages
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `chat_id=eq.${activeChatId}`,
          },
          (payload) => {
            console.log("[Realtime] postgres_changes message INSERT:", payload.new);
            const raw = payload.new as Record<string, unknown>;
            const incoming: Message = {
              id: raw.id as string,
              chatId: raw.chat_id as string,
              userId: raw.user_id as string,
              content: raw.content as string,
              status: (raw.status as "sent" | "delivered" | "read") || "sent",
              parentId: (raw.parent_id as string) || null,
              editedAt: raw.edited_at ? new Date(raw.edited_at as string) : null,
              deletedAt: raw.deleted_at ? new Date(raw.deleted_at as string) : null,
              createdAt: new Date(raw.created_at as string),
            };
            appendMessage(activeChatId!, incoming);
          }
        )
        // UPDATE: edits, deletes, status changes
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "messages",
            filter: `chat_id=eq.${activeChatId}`,
          },
          (payload) => {
            console.log("[Realtime] postgres_changes message UPDATE:", payload.new);
            const raw = payload.new as Record<string, unknown>;
            updateMessage(activeChatId!, raw.id as string, {
              content: raw.content as string,
              status: (raw.status as "sent" | "delivered" | "read") || "sent",
              editedAt: raw.edited_at ? new Date(raw.edited_at as string) : null,
              deletedAt: raw.deleted_at ? new Date(raw.deleted_at as string) : null,
            });
          }
        )
        // Reactions INSERT
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "reactions",
          },
          (payload) => {
            const raw = payload.new as Record<string, unknown>;
            addReactionToStore(activeChatId!, {
              id: raw.id as string,
              messageId: raw.message_id as string,
              userId: raw.user_id as string,
              emoji: raw.emoji as string,
              createdAt: new Date(raw.created_at as string),
            });
          }
        )
        // Reactions DELETE
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "reactions",
          },
          (payload) => {
            const raw = payload.old as Record<string, unknown>;
            if (raw.id) {
              removeReactionFromStore(activeChatId!, raw.id as string);
            }
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
        // Broadcast for message edits/deletes
        .on(
          "broadcast",
          { event: "message-updated" },
          (payload) => {
            const data = payload.payload as { messageId: string } & Partial<Message>;
            updateMessage(activeChatId!, data.messageId, {
              content: data.content,
              editedAt: data.editedAt ? new Date(data.editedAt) : undefined,
              deletedAt: data.deletedAt ? new Date(data.deletedAt) : undefined,
            });
          }
        )
        .subscribe((status, err) => {
          if (status === "SUBSCRIBED") {
            console.log(`[Realtime] messages:${activeChatId}: subscribed`);
          } else if (status === "CHANNEL_ERROR") {
            console.warn(`[Realtime] messages:${activeChatId}: channel error (will retry)`, err ?? "");
          } else if (status === "TIMED_OUT") {
            console.warn(`[Realtime] messages:${activeChatId}: timed out (will retry)`);
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
    async (content: string, parentId?: string) => {
      if (!activeChatId || !canWrite || !content.trim()) return;

      const optimisticMsg: Message = {
        id: `optimistic-${Date.now()}`,
        chatId: activeChatId,
        userId: "optimistic",
        content: content.trim(),
        status: "sent",
        parentId: parentId || null,
        editedAt: null,
        deletedAt: null,
        createdAt: new Date(),
      };

      appendMessage(activeChatId, optimisticMsg);

      try {
        const res = await fetch(`/api/chat/${activeChatId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: content.trim(), parentId }),
        });

        if (!res.ok) throw new Error("Failed to send message");

        const { data: savedMsg } = await res.json();

        // Replace optimistic entry with the real saved message.
        setMessages(
          activeChatId,
          useChatStore
            .getState()
            .messages[activeChatId].map((m) =>
              m.id === optimisticMsg.id ? savedMsg : m
            )
        );

        // Broadcast to other clients on the same channel.
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

  // --- Edit a message ---

  const editMessageFn = useCallback(
    async (messageId: string, content: string) => {
      if (!activeChatId) return;

      // Optimistic update
      const prev = useChatStore.getState().messages[activeChatId]?.find((m) => m.id === messageId);
      if (prev) {
        updateMessage(activeChatId, messageId, {
          content,
          editedAt: new Date(),
        });
      }

      try {
        const res = await fetch(`/api/chat/${activeChatId}/messages`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId, content }),
        });

        if (!res.ok) {
          // Revert on failure
          if (prev) updateMessage(activeChatId, messageId, { content: prev.content, editedAt: prev.editedAt });
          return;
        }

        const { data } = await res.json();

        // Broadcast update to other clients
        channelRef.current?.send({
          type: "broadcast",
          event: "message-updated",
          payload: { messageId, content: data.content, editedAt: data.editedAt },
        });
      } catch {
        if (prev) updateMessage(activeChatId, messageId, { content: prev.content, editedAt: prev.editedAt });
      }
    },
    [activeChatId]
  );

  // --- Delete a message ---

  const deleteMessageFn = useCallback(
    async (messageId: string) => {
      if (!activeChatId) return;

      const prev = useChatStore.getState().messages[activeChatId]?.find((m) => m.id === messageId);

      // Optimistic update
      updateMessage(activeChatId, messageId, {
        content: "[Message deleted]",
        deletedAt: new Date(),
      });

      try {
        const res = await fetch(`/api/chat/${activeChatId}/messages`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId }),
        });

        if (!res.ok && prev) {
          updateMessage(activeChatId, messageId, { content: prev.content, deletedAt: prev.deletedAt });
          return;
        }

        // Broadcast
        channelRef.current?.send({
          type: "broadcast",
          event: "message-updated",
          payload: { messageId, content: "[Message deleted]", deletedAt: new Date().toISOString() },
        });
      } catch {
        if (prev) updateMessage(activeChatId, messageId, { content: prev.content, deletedAt: prev.deletedAt });
      }
    },
    [activeChatId]
  );

  // --- Toggle reaction (add or remove) ---

  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!activeChatId) return;

      try {
        // Check if user already reacted with this emoji
        const existing = useChatStore
          .getState()
          .reactions[activeChatId]?.find(
            (r) =>
              r.messageId === messageId &&
              r.emoji === emoji &&
              r.userId === useSessionStore.getState().user?.id
          );

        if (existing) {
          // Remove reaction
          removeReactionFromStore(activeChatId, existing.id);
          await fetch(`/api/chat/${activeChatId}/messages/reactions`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messageId, emoji }),
          });
        } else {
          // Add reaction
          const res = await fetch(`/api/chat/${activeChatId}/messages/reactions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messageId, emoji }),
          });

          if (res.ok) {
            const { data } = await res.json();
            if (data) addReactionToStore(activeChatId, data);
          }
        }
      } catch (e) {
        console.error("[toggleReaction]", e);
      }
    },
    [activeChatId]
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
    reactions,
    activeChatId,
    canWrite,
    loading,
    error,
    setActiveChat,
    sendMessage,
    editMessage: editMessageFn,
    deleteMessage: deleteMessageFn,
    toggleReaction,
    refreshChats,
    joinChat,
    declineChat,
  };
}
