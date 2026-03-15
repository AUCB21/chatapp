"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { useChatStore, selectActiveMessages, selectActiveReactions } from "@/store/chatStore";
import type { ChatState } from "@/store/chatStore";
import { supabase } from "@/lib/supabaseClient";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { useSessionStore } from "@/store/sessionStore";
import type { Message, Reaction } from "@/db/schema";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { playPing } from "@/lib/sounds";

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
  isLoadingMore: boolean;
  hasMoreMessages: boolean;

  // Actions
  setActiveChat: (chatId: string | null) => void;
  sendMessage: (content: string, parentId?: string, files?: File[]) => Promise<void>;
  retrySend: (failedMessageId: string) => Promise<void>;
  editMessage: (messageId: string, content: string) => Promise<void>;
  deleteMessage: (messageId: string, mode?: "for_me" | "for_everyone") => Promise<void>;
  deleteChat: (chatId: string, mode: "for_me" | "for_everyone") => Promise<void>;
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
  refreshChats: () => Promise<void>;
  loadMoreMessages: () => Promise<void>;
  joinChat: (chatId: string) => Promise<void>;
  declineChat: (chatId: string) => Promise<void>;
}

type MessagePayload = Omit<Message, "createdAt" | "editedAt" | "deletedAt"> & {
  createdAt: string | Date;
  editedAt: string | Date | null;
  deletedAt: string | Date | null;
};

function normalizeMessage(message: MessagePayload): Message {
  const normalizeNullableDate = (value: string | Date | null): Date | null => {
    if (!value) return null;
    return value instanceof Date ? value : new Date(value);
  };

  return {
    ...message,
    createdAt: message.createdAt instanceof Date ? message.createdAt : new Date(message.createdAt),
    editedAt: normalizeNullableDate(message.editedAt),
    deletedAt: normalizeNullableDate(message.deletedAt),
  };
}

function normalizeMessages(messages: MessagePayload[]) {
  return messages.map(normalizeMessage);
}

function getDeletedForMeStorageKey(userId: string) {
  return `deleted-for-me-${userId}`;
}

function readPendingDeletedMessages(userId: string | null) {
  if (!userId) return [] as string[];

  try {
    const stored = localStorage.getItem(getDeletedForMeStorageKey(userId));
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed)
      ? [...new Set(parsed.filter((value): value is string => typeof value === "string"))]
      : [];
  } catch {
    return [];
  }
}

function writePendingDeletedMessages(userId: string | null, messageIds: string[]) {
  if (!userId) return;

  try {
    if (messageIds.length === 0) {
      localStorage.removeItem(getDeletedForMeStorageKey(userId));
      return;
    }

    localStorage.setItem(
      getDeletedForMeStorageKey(userId),
      JSON.stringify([...new Set(messageIds)])
    );
  } catch {
    // ignore storage failures
  }
}

function addPendingDeletedMessage(userId: string | null, messageId: string) {
  const ids = readPendingDeletedMessages(userId);
  if (ids.includes(messageId)) return;
  writePendingDeletedMessages(userId, [...ids, messageId]);
}

function removePendingDeletedMessage(userId: string | null, messageId: string) {
  const ids = readPendingDeletedMessages(userId).filter((id) => id !== messageId);
  writePendingDeletedMessages(userId, ids);
}

// --- Hook ---

export function useChat(): UseChatReturn {
  const isReady = useSupabaseAuth();
  const userId = useSessionStore((s) => s.user?.id ?? null);
  const userEmail = useSessionStore((s) => s.user?.email ?? null);

  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const {
    chats,
    activeChatId,
    loading,
    error,
    hasMoreMessages,
    setChats,
    setActiveChat: _setActiveChat,
    setMessages,
    prependMessages,
    appendMessage,
    updateMessage,
    removeMessage,
    setReactions,
    setAttachments,
    addAttachments,
    addReaction: addReactionToStore,
    removeReaction: removeReactionFromStore,
    setMembership,
    removeMembership,
    setLoading,
    setError,
    setHasMore,
    setUnreadCounts,
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
  const declineRemovalTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // --- Fetch all accessible chats on mount ---

  const refreshChats = useCallback(async () => {
    setLoading("chats", true);
    setError("chats", null);

    try {
      const res = await fetch("/api/chat");
      if (!res.ok) throw new Error("Failed to fetch chats");
      const { data } = await res.json();
      setChats(data.chats ?? data);
      if (data.unreadCounts) setUnreadCounts(data.unreadCounts);
    } catch (e) {
      setError("chats", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading("chats", false);
    }
  }, []);

  // Skip initial chat fetch + deleted-for-me sync if boot preload already ran
  const bootedRef = useRef(useChatStore.getState().booted);

  useEffect(() => {
    if (!isReady || !userId) return;
    if (bootedRef.current) { bootedRef.current = false; return; }
    refreshChats();
  }, [isReady, userId]);

  useEffect(() => {
    if (!isReady || !userId) return;
    if (useChatStore.getState().booted) return; // boot already synced

    const pendingIds = readPendingDeletedMessages(userId);
    if (pendingIds.length === 0) return;

    let cancelled = false;

    async function syncPendingDeletedMessages() {
      try {
        const res = await fetch("/api/chat/deleted-for-me", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageIds: pendingIds }),
        });

        if (!res.ok || cancelled) return;

        writePendingDeletedMessages(userId, []);
      } catch {
        // Keep local fallback and retry on a later session.
      }
    }

    syncPendingDeletedMessages();

    return () => {
      cancelled = true;
    };
  }, [isReady, userId]);

  // --- Global background listener: badges + notifications + ping ---
  // Watches ALL new messages across every chat the user belongs to.
  // The memberships UPDATE subscription (below) carries the authoritative DB
  // count and will override the client-side increment when it fires.

  useEffect(() => {
    if (!isReady || !userId) return;

    const channel = supabase
      .channel("global-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const raw = payload.new as Record<string, unknown>;
          const fromUserId = raw.user_id as string;
          const chatId = raw.chat_id as string;
          const content = raw.content as string;

          if (fromUserId === userId) return; // own messages — skip

          const state = useChatStore.getState();
          const isActiveChat = state.activeChatId === chatId;

          // Active chat: append message to the view as a fallback
          // (the per-chat postgres_changes subscription may miss events
          // when the messages SELECT RLS policy has sub-queries)
          if (isActiveChat) {
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
            appendMessage(chatId, incoming);

            // Mark as read since user is looking at the chat
            if (document.visibilityState === "visible") {
              fetch(`/api/chat/${chatId}/messages`, { method: "PUT" }).catch(() => {});
            }
          }

          // Client-side badge increment (DB trigger + memberships UPDATE
          // will correct this to the authoritative count when it arrives)
          if (!isActiveChat) {
            state.incrementUnread(chatId);
          }

          // Check mute status
          const isMuted = (() => {
            try {
              const stored = localStorage.getItem("muted-chats");
              return stored ? (JSON.parse(stored) as string[]).includes(chatId) : false;
            } catch { return false; }
          })();
          if (isMuted) return;

          // Browser notification + ping
          if (document.visibilityState !== "visible") {
            const chat = state.chats.find((c) => c.id === chatId);
            const title = chat?.displayName ?? "New message";
            if (
              typeof Notification !== "undefined" &&
              Notification.permission === "granted"
            ) {
              try {
                new Notification(title, {
                  body: content.length > 80 ? content.slice(0, 80) + "…" : content,
                  tag: `msg-${chatId}`,
                });
              } catch { /* */ }
            }
            playPing();
          } else if (!isActiveChat) {
            playPing();
          }
        }
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [isReady, userId]);

  // --- Refresh chat list on relevant DB changes ---
  // • chats:INSERT        — a new chat was created
  // • memberships:INSERT  — an invitee accepted (creator's client updates)
  // • invitations:INSERT  — you were invited (your client sees the pending chat)
  // Requires Realtime to be enabled on all three tables in Supabase.

  useEffect(() => {
    if (!isReady || !userId) return;

    const channel = supabase
      .channel("chat-list-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "memberships",
          filter: `user_id=eq.${userId}`,
        },
        () => { refreshChats(); }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "memberships",
          filter: `user_id=eq.${userId}`,
        },
        () => { refreshChats(); }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "memberships",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const chatId = row.chat_id as string;
          const count = row.unread_count as number;
          const state = useChatStore.getState();
          const isActiveChat = state.activeChatId === chatId;

          // Skip everything for the active chat (user is looking at it)
          if (isActiveChat) return;

          const prevCount = state.unreadCounts[chatId] ?? 0;
          state.setUnreadCount(chatId, count);

          // New messages arrived → sound + notification
          if (count > prevCount) {
            const isMuted = (() => {
              try {
                const stored = localStorage.getItem("muted-chats");
                return stored ? (JSON.parse(stored) as string[]).includes(chatId) : false;
              } catch { return false; }
            })();
            if (isMuted) return;

            const chat = state.chats.find((c) => c.id === chatId);
            const title = chat?.displayName ?? "New message";

            if (document.visibilityState !== "visible") {
              if (typeof Notification !== "undefined" && Notification.permission === "granted") {
                try { new Notification(title, { body: "New message", tag: `msg-${chatId}` }); } catch { /* */ }
              }
            }
            playPing();
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "deleted_for_me",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const messageId = row.message_id as string;
          const state = useChatStore.getState();

          for (const [chatId, chatMessages] of Object.entries(state.messages)) {
            if (chatMessages.some((message) => message.id === messageId)) {
              state.removeMessage(chatId, messageId);
              break;
            }
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "invitations",
        },
        () => { refreshChats(); }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [isReady, userId, userEmail, refreshChats]);

  // --- Fetch messages + subscribe to Realtime when active chat changes ---
  // Also re-runs when the user accepts a pending invitation (role changes).

  useEffect(() => {
    if (!isReady || !activeChatId) return;
    const activeId = activeChatId;

    // Pending chats show an accept/decline prompt — no messages to load
    if (activeMembership === "pending") return;

    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }

    async function fetchAndSubscribe() {
      setLoading("messages", true);
      setError("messages", null);

      const storeMessages = useChatStore.getState().messages;
      const alreadyFetched = activeId in storeMessages;
      if (!alreadyFetched) {
        try {
          const res = await fetch(`/api/chat/${activeId}/messages`);

          if (res.status === 403) {
            _setActiveChat(null);
            return;
          }

          if (!res.ok) throw new Error("Failed to fetch messages");

          const { data } = await res.json();
          const deletedForMe = new Set(readPendingDeletedMessages(userId));
          if (data.messages) {
            setMessages(
              activeId,
              normalizeMessages(data.messages).filter((m) => !deletedForMe.has(m.id))
            );
            setReactions(activeId, data.reactions ?? []);
            if (data.attachments) setAttachments(activeId, data.attachments);
            setHasMore(activeId, data.hasMore ?? false);
          } else {
            setMessages(
              activeId,
              normalizeMessages(data as MessagePayload[]).filter((m) => !deletedForMe.has(m.id))
            );
            setHasMore(activeId, false);
          }
        } catch (e) {
          setError("messages", e instanceof Error ? e.message : "Unknown error");
          return;
        } finally {
          setLoading("messages", false);
        }
      } else {
        setLoading("messages", false);
      }

      const isReactionForActiveChat = (messageId: string) =>
        useChatStore
          .getState()
          .messages[activeId]
          ?.some((message) => message.id === messageId) ?? false;

      const channel = supabase
        .channel(`messages:${activeId}`)
        // INSERT: new messages
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `chat_id=eq.${activeId}`,
          },
          (payload) => {
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
            appendMessage(activeId, incoming);

            // Mark as read if the message is from another user and tab is visible
            if (incoming.userId !== userId && document.visibilityState === "visible") {
              fetch(`/api/chat/${activeId}/messages`, { method: "PUT" }).catch(() => {});
            }
          }
        )
        // UPDATE: edits, deletes, status changes
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "messages",
            filter: `chat_id=eq.${activeId}`,
          },
          (payload) => {
            const raw = payload.new as Record<string, unknown>;
            updateMessage(activeId, raw.id as string, {
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
            const messageId = raw.message_id as string;
            if (!isReactionForActiveChat(messageId)) return;
            addReactionToStore(activeId, {
              id: raw.id as string,
              messageId,
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
            const messageId = raw.message_id as string | undefined;
            if (raw.id && messageId && isReactionForActiveChat(messageId)) {
              removeReactionFromStore(activeId, raw.id as string);
            }
          }
        )
        // Fallback: broadcast (direct WebSocket, no publication/RLS needed)
        .on(
          "broadcast",
          { event: "new-message" },
          (payload) => {
            const msg = payload.payload as Message & { attachments?: unknown[] };
            const { attachments: msgAttachments, ...rest } = msg;
            appendMessage(activeId, {
              ...rest,
              createdAt: new Date(rest.createdAt),
            });
            if (msgAttachments?.length) {
              useChatStore.getState().addAttachments(activeId, rest.id, msgAttachments as import("@/store/chatStore").AttachmentWithUrl[]);
            }
          }
        )
        // Broadcast for message edits/deletes
        .on(
          "broadcast",
          { event: "message-updated" },
          (payload) => {
            const data = payload.payload as { messageId: string } & Partial<Message>;
            updateMessage(activeId, data.messageId, {
              content: data.content,
              editedAt: data.editedAt ? new Date(data.editedAt) : undefined,
              deletedAt: data.deletedAt ? new Date(data.deletedAt) : undefined,
            });
          }
        )
        // Broadcast for reaction additions
        .on(
          "broadcast",
          { event: "reaction-added" },
          (payload) => {
            const data = payload.payload as {
              id: string;
              messageId: string;
              userId: string;
              emoji: string;
              createdAt: string;
            };
            // Avoid duplicates — only add if not already in store
            const existing = useChatStore
              .getState()
              .reactions[activeId]?.find((r) => r.id === data.id);
            if (!existing) {
              addReactionToStore(activeId, {
                ...data,
                createdAt: new Date(data.createdAt),
              });
            }
          }
        )
        // Broadcast for reaction removals
        .on(
          "broadcast",
          { event: "reaction-removed" },
          (payload) => {
            const data = payload.payload as { reactionId: string; messageId: string };
            removeReactionFromStore(activeId, data.reactionId);
          }
        )
        .subscribe();

      channelRef.current = channel;
    }

    fetchAndSubscribe();

    // Mark messages as read when user returns to the tab
    function handleVisibility() {
      if (document.visibilityState === "visible" && activeId) {
        fetch(`/api/chat/${activeId}/messages`, { method: "PUT" }).catch(() => {});
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      channelRef.current?.unsubscribe();
      channelRef.current = null;
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [isReady, activeChatId, activeMembership]);

  // --- Send message with optimistic update ---

  const sendMessage = useCallback(
    async (content: string, parentId?: string, files?: File[]) => {
      if (!activeChatId || !canWrite) return;
      const hasFiles = files && files.length > 0;
      if (!content.trim() && !hasFiles) return;

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
        let res: Response;

        if (hasFiles) {
          const formData = new FormData();
          formData.append("content", content.trim());
          if (parentId) formData.append("parentId", parentId);
          for (const file of files) {
            formData.append("files", file);
          }
          res = await fetch(`/api/chat/${activeChatId}/messages`, {
            method: "POST",
            body: formData,
          });
        } else {
          res = await fetch(`/api/chat/${activeChatId}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: content.trim(), parentId }),
          });
        }

        if (!res.ok) throw new Error("Failed to send message");

        const { data: savedMsg } = await res.json();
        const normalizedSavedMsg = normalizeMessage(savedMsg as MessagePayload);

        // Replace optimistic entry with the real saved message.
        setMessages(
          activeChatId,
          useChatStore
            .getState()
            .messages[activeChatId].map((m) =>
              m.id === optimisticMsg.id ? normalizedSavedMsg : m
            )
        );

        // Store attachments if present
        if (savedMsg.attachments?.length > 0) {
          addAttachments(activeChatId, normalizedSavedMsg.id, savedMsg.attachments);
        }

        // Broadcast to other clients on the same channel.
        channelRef.current?.send({
          type: "broadcast",
          event: "new-message",
          payload: { ...normalizedSavedMsg, attachments: savedMsg.attachments },
        });
      } catch {
        // Mark the optimistic entry as failed instead of removing it.
        const failedMsg: Message = {
          ...optimisticMsg,
          id: optimisticMsg.id.replace("optimistic-", "failed-"),
        };
        setMessages(
          activeChatId,
          useChatStore
            .getState()
            .messages[activeChatId].map((m) =>
              m.id === optimisticMsg.id ? failedMsg : m
            )
        );
      }
    },
    [activeChatId, canWrite]
  );

  // --- Retry a failed message ---

  const retrySend = useCallback(
    async (failedMessageId: string) => {
      if (!activeChatId || !canWrite) return;

      const msgs = useChatStore.getState().messages[activeChatId] ?? [];
      const failedMsg = msgs.find((m) => m.id === failedMessageId);
      if (!failedMsg) return;

      // Remove the failed message and re-send
      setMessages(
        activeChatId,
        msgs.filter((m) => m.id !== failedMessageId)
      );
      await sendMessage(failedMsg.content, failedMsg.parentId ?? undefined);
    },
    [activeChatId, canWrite, sendMessage]
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
    async (messageId: string, mode: "for_me" | "for_everyone" = "for_everyone") => {
      if (!activeChatId) return;

      if (mode === "for_me") {
        removeMessage(activeChatId, messageId);
        addPendingDeletedMessage(userId, messageId);

        try {
          const res = await fetch(`/api/chat/${activeChatId}/messages`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messageId, mode: "for_me" }),
          });

          if (res.ok) {
            removePendingDeletedMessage(userId, messageId);
          }
        } catch {
          // Keep the local fallback and let silent sync retry later.
        }
        return;
      }

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
    [activeChatId, removeMessage]
  );

  // --- Toggle reaction (add or remove) ---

  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!activeChatId) return;

      const currentUserId = useSessionStore.getState().user?.id;
      if (!currentUserId) return;

      // Check if user already reacted with this emoji
      const existing = useChatStore
        .getState()
        .reactions[activeChatId]?.find(
          (r) =>
            r.messageId === messageId &&
            r.emoji === emoji &&
            r.userId === currentUserId
        );

      if (existing) {
        // Optimistic remove
        removeReactionFromStore(activeChatId, existing.id);

        try {
          await fetch(`/api/chat/${activeChatId}/messages/reactions`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messageId, emoji }),
          });

          // Broadcast removal to other clients
          channelRef.current?.send({
            type: "broadcast",
            event: "reaction-removed",
            payload: { reactionId: existing.id, messageId },
          });
        } catch {
          // Revert — re-add the reaction
          addReactionToStore(activeChatId, existing);
        }
      } else {
        // Optimistic add with temporary ID
        const tempId = `optimistic-reaction-${Date.now()}`;
        const optimisticReaction = {
          id: tempId,
          messageId,
          userId: currentUserId,
          emoji,
          createdAt: new Date(),
        };
        addReactionToStore(activeChatId, optimisticReaction);

        try {
          const res = await fetch(`/api/chat/${activeChatId}/messages/reactions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messageId, emoji }),
          });

          if (res.ok) {
            const { data } = await res.json();
            if (data) {
              // Replace optimistic with real reaction
              removeReactionFromStore(activeChatId, tempId);
              addReactionToStore(activeChatId, data);

              // Broadcast addition to other clients
              channelRef.current?.send({
                type: "broadcast",
                event: "reaction-added",
                payload: data,
              });
            }
          } else {
            // Revert on failure
            removeReactionFromStore(activeChatId, tempId);
          }
        } catch {
          // Revert on error
          removeReactionFromStore(activeChatId, tempId);
        }
      }
    },
    [activeChatId]
  );

  // --- Load older messages (pagination) ---

  const loadMoreMessages = useCallback(async () => {
    if (!activeChatId || isLoadingMore) return;
    const msgs = useChatStore.getState().messages[activeChatId];
    if (!msgs || msgs.length === 0) return;

    const oldest = msgs[0];
    setIsLoadingMore(true);
    try {
      const before = new Date(oldest.createdAt);
      if (Number.isNaN(before.getTime())) return;

      const res = await fetch(
        `/api/chat/${activeChatId}/messages?before=${encodeURIComponent(before.toISOString())}`
      );
      if (!res.ok) return;
      const { data } = await res.json();
      if (data.messages?.length > 0) {
        const deletedForMe = new Set(readPendingDeletedMessages(userId));
        prependMessages(
          activeChatId,
          normalizeMessages(data.messages).filter((m) => !deletedForMe.has(m.id))
        );
        if (data.attachments) setAttachments(activeChatId, data.attachments);
      }
      setHasMore(activeChatId, data.hasMore ?? false);
    } catch {
      // non-fatal
    } finally {
      setIsLoadingMore(false);
    }
  }, [activeChatId, isLoadingMore, prependMessages, setHasMore, userId]);

  // --- Delete a chat ---

  const deleteChatFn = useCallback(
    async (chatId: string, mode: "for_me" | "for_everyone") => {
      const res = await fetch(`/api/chat/${chatId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Failed to delete chat");
      }
      removeMembership(chatId);
    },
    [removeMembership]
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
      setMembership(chatId, "declined");

      const existingTimer = declineRemovalTimersRef.current[chatId];
      if (existingTimer) {
        clearTimeout(existingTimer);
        delete declineRemovalTimersRef.current[chatId];
      }

      try {
        const res = await fetch(`/api/chat/${chatId}/join`, { method: "DELETE" });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error ?? "Failed to decline invitation");
        }

        declineRemovalTimersRef.current[chatId] = setTimeout(() => {
          removeMembership(chatId);
          delete declineRemovalTimersRef.current[chatId];
        }, 2000);
      } catch (e) {
        setMembership(chatId, "pending");
        throw e;
      }
    },
    [removeMembership, setMembership]
  );

  useEffect(() => {
    return () => {
      Object.values(declineRemovalTimersRef.current).forEach(clearTimeout);
      declineRemovalTimersRef.current = {};
    };
  }, []);

  const setActiveChat = useCallback((chatId: string | null) => {
    _setActiveChat(chatId);
  }, []);

  const hasMore = activeChatId ? (hasMoreMessages[activeChatId] ?? false) : false;

  return {
    chats,
    messages,
    reactions,
    activeChatId,
    canWrite,
    loading,
    error,
    isLoadingMore,
    hasMoreMessages: hasMore,
    setActiveChat,
    sendMessage,
    retrySend,
    editMessage: editMessageFn,
    deleteMessage: deleteMessageFn,
    deleteChat: deleteChatFn,
    toggleReaction,
    refreshChats,
    loadMoreMessages,
    joinChat,
    declineChat,
  };
}
