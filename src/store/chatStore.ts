import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { Chat, Message, MemberRole, Reaction, Attachment } from "../db/schema";

// --- Types ---

export type ChatRole = MemberRole | "pending" | "declined";
export type LastMessagePreview = { content: string; senderId: string; senderName: string; createdAt: Date };
export type ChatWithRole = Chat & { role: ChatRole; displayName: string; isSelfChat?: boolean; lastMessage?: LastMessagePreview | null };

/** Grouped reactions for a message: emoji → { count, users[] } */
export type ReactionGroup = Record<string, { count: number; users: string[] }>;

/** Attachment with a signed URL for display */
export type AttachmentWithUrl = Attachment & { signedUrl?: string | null };

/** Read receipt with display name for UI */
export type ReadReceiptEntry = { userId: string; displayName: string; lastReadAt: string };

export interface ChatState {
  // Data
  chats: ChatWithRole[];
  activeChatId: string | null;
  messages: Record<string, Message[]>; // keyed by chatId
  memberships: Record<string, ChatRole>; // chatId → user's role (incl. "pending")
  reactions: Record<string, Reaction[]>; // keyed by chatId
  attachments: Record<string, Record<string, AttachmentWithUrl[]>>; // chatId → messageId → attachments
  readReceipts: Record<string, ReadReceiptEntry[]>; // chatId → receipts
  unreadCounts: Record<string, number>; // chatId → unread message count
  hasMoreMessages: Record<string, boolean>; // chatId → whether older messages exist
  booted: boolean; // true after boot preload completes
  starredMessageIds: Set<string>; // preloaded during boot
  blockedUserIds: Set<string>; // preloaded during boot

  // Loading / error per-resource
  loading: {
    chats: boolean;
    messages: boolean;
  };
  error: {
    chats: string | null;
    messages: string | null;
  };

  // Actions
  setBooted: (value: boolean) => void;
  setChats: (chats: ChatWithRole[]) => void;
  updateChat: (chatId: string, updates: Partial<Pick<ChatWithRole, "name" | "displayName">>) => void;
  updateChatLastMessage: (chatId: string, lastMessage: LastMessagePreview) => void;
  setActiveChat: (chatId: string | null) => void;
  setMessages: (chatId: string, messages: Message[]) => void;
  prependMessages: (chatId: string, messages: Message[]) => void;
  appendMessage: (chatId: string, message: Message) => void;
  updateMessage: (chatId: string, messageId: string, updates: Partial<Message>) => void;
  removeMessage: (chatId: string, messageId: string) => void;
  setAttachments: (chatId: string, map: Record<string, AttachmentWithUrl[]>) => void;
  addAttachments: (chatId: string, messageId: string, items: AttachmentWithUrl[]) => void;
  refreshAttachmentUrls: (chatId: string, urlMap: Record<string, string>) => void;
  setReactions: (chatId: string, reactions: Reaction[]) => void;
  addReaction: (chatId: string, reaction: Reaction) => void;
  removeReaction: (chatId: string, reactionId: string) => void;
  setMembership: (chatId: string, role: ChatRole) => void;
  removeMembership: (chatId: string) => void;
  setReadReceipts: (chatId: string, receipts: ReadReceiptEntry[]) => void;
  setUnreadCounts: (counts: Record<string, number>) => void;
  setUnreadCount: (chatId: string, count: number) => void;
  incrementUnread: (chatId: string) => void;
  clearUnread: (chatId: string) => void;
  setHasMore: (chatId: string, value: boolean) => void;
  setLoading: (key: keyof ChatState["loading"], value: boolean) => void;
  setError: (key: keyof ChatState["error"], value: string | null) => void;
  bumpChatToTop: (chatId: string) => void;
  setStarredMessageIds: (ids: Set<string>) => void;
  toggleStarredMessage: (messageId: string) => void;
  setBlockedUserIds: (ids: Set<string>) => void;
  toggleBlockedUser: (userId: string) => void;
  reset: () => void;
}

// --- Initial state ---

const initialState = {
  chats: [],
  activeChatId: null,
  messages: {},
  memberships: {},
  reactions: {},
  attachments: {},
  readReceipts: {},
  unreadCounts: {},
  hasMoreMessages: {},
  booted: false,
  starredMessageIds: new Set<string>(),
  blockedUserIds: new Set<string>(),
  loading: { chats: false, messages: false },
  error: { chats: null, messages: null },
};

// --- Store ---

export const useChatStore = create<ChatState>()(
  devtools(
    (set) => ({
      ...initialState,

      setBooted: (value) =>
        set(() => ({ booted: value }), false, "setBooted"),

      setChats: (chats) =>
        set(
          (state) => {
            // Sort: self-chat first, then by most recent message in store,
            // then by chat createdAt desc. Pending/declined go to the bottom.
            const msgMap = state.messages;
            const sorted = [...chats].sort((a, b) => {
              // Self-chat pinned at top
              if (a.isSelfChat && !b.isSelfChat) return -1;
              if (!a.isSelfChat && b.isSelfChat) return 1;
              // Pending/declined at bottom
              const aInactive = a.role === "pending" || a.role === "declined";
              const bInactive = b.role === "pending" || b.role === "declined";
              if (aInactive && !bInactive) return 1;
              if (!aInactive && bInactive) return -1;
              // Sort by last message timestamp desc
              const aLast = msgMap[a.id]?.at(-1)?.createdAt ?? a.createdAt;
              const bLast = msgMap[b.id]?.at(-1)?.createdAt ?? b.createdAt;
              return new Date(bLast).getTime() - new Date(aLast).getTime();
            });
            return {
              chats: sorted,
              memberships: chats.reduce(
                (acc, c) => ({ ...acc, [c.id]: c.role }),
                state.memberships
              ),
            };
          },
          false,
          "setChats"
        ),

      updateChat: (chatId, updates) =>
        set(
          (state) => ({
            chats: state.chats.map((c) =>
              c.id === chatId ? { ...c, ...updates } : c
            ),
          }),
          false,
          "updateChat"
        ),

      updateChatLastMessage: (chatId, lastMessage) =>
        set(
          (state) => ({
            chats: state.chats.map((c) =>
              c.id === chatId ? { ...c, lastMessage } : c
            ),
          }),
          false,
          "updateChatLastMessage"
        ),

      setActiveChat: (chatId) =>
        set(
          (state) => {
            if (!chatId) return { activeChatId: null };
            const { [chatId]: _, ...restUnread } = state.unreadCounts;
            return { activeChatId: chatId, unreadCounts: restUnread };
          },
          false,
          "setActiveChat"
        ),

      setMessages: (chatId, messages) =>
        set(
          (state) => ({ messages: { ...state.messages, [chatId]: messages } }),
          false,
          "setMessages"
        ),

      prependMessages: (chatId, newMessages) =>
        set(
          (state) => {
            const existing = state.messages[chatId] ?? [];
            const existingIds = new Set(existing.map((m) => m.id));
            const fresh = newMessages.filter((m) => !existingIds.has(m.id));
            return {
              messages: {
                ...state.messages,
                [chatId]: [...fresh, ...existing],
              },
            };
          },
          false,
          "prependMessages"
        ),

      appendMessage: (chatId, message) =>
        set(
          (state) => {
            const existing = state.messages[chatId] ?? [];
            if (existing.some((m) => m.id === message.id)) return state;
            return {
              messages: {
                ...state.messages,
                [chatId]: [...existing, message],
              },
            };
          },
          false,
          "appendMessage"
        ),

      updateMessage: (chatId, messageId, updates) =>
        set(
          (state) => {
            const existing = state.messages[chatId];
            if (!existing) return state;
            return {
              messages: {
                ...state.messages,
                [chatId]: existing.map((m) =>
                  m.id === messageId ? { ...m, ...updates } : m
                ),
              },
            };
          },
          false,
          "updateMessage"
        ),

      removeMessage: (chatId, messageId) =>
        set(
          (state) => {
            const existing = state.messages[chatId];
            if (!existing) return state;
            const nextReactions = (state.reactions[chatId] ?? []).filter(
              (reaction) => reaction.messageId !== messageId
            );
            return {
              messages: {
                ...state.messages,
                [chatId]: existing.filter((m) => m.id !== messageId),
              },
              reactions: {
                ...state.reactions,
                [chatId]: nextReactions,
              },
            };
          },
          false,
          "removeMessage"
        ),

      setAttachments: (chatId, map) =>
        set(
          (state) => ({
            attachments: {
              ...state.attachments,
              [chatId]: { ...(state.attachments[chatId] ?? {}), ...map },
            },
          }),
          false,
          "setAttachments"
        ),

      addAttachments: (chatId, messageId, items) =>
        set(
          (state) => ({
            attachments: {
              ...state.attachments,
              [chatId]: {
                ...(state.attachments[chatId] ?? {}),
                [messageId]: items,
              },
            },
          }),
          false,
          "addAttachments"
        ),

      refreshAttachmentUrls: (chatId, urlMap) =>
        set(
          (state) => {
            const chatAttachments = state.attachments[chatId];
            if (!chatAttachments) return state;
            const updated: Record<string, AttachmentWithUrl[]> = {};
            for (const [msgId, atts] of Object.entries(chatAttachments)) {
              updated[msgId] = atts.map((a) =>
                urlMap[a.storagePath] ? { ...a, signedUrl: urlMap[a.storagePath] } : a
              );
            }
            return {
              attachments: { ...state.attachments, [chatId]: updated },
            };
          },
          false,
          "refreshAttachmentUrls"
        ),

      setReactions: (chatId, reactions) =>
        set(
          (state) => ({
            reactions: { ...state.reactions, [chatId]: reactions },
          }),
          false,
          "setReactions"
        ),

      addReaction: (chatId, reaction) =>
        set(
          (state) => {
            const existing = state.reactions[chatId] ?? [];
            if (existing.some((r) => r.id === reaction.id)) return state;
            return {
              reactions: {
                ...state.reactions,
                [chatId]: [...existing, reaction],
              },
            };
          },
          false,
          "addReaction"
        ),

      removeReaction: (chatId, reactionId) =>
        set(
          (state) => {
            const existing = state.reactions[chatId] ?? [];
            return {
              reactions: {
                ...state.reactions,
                [chatId]: existing.filter((r) => r.id !== reactionId),
              },
            };
          },
          false,
          "removeReaction"
        ),

      setMembership: (chatId, role) =>
        set(
          (state) => ({
            memberships: { ...state.memberships, [chatId]: role },
          }),
          false,
          "setMembership"
        ),

      removeMembership: (chatId) =>
        set(
          (state) => {
            const { [chatId]: _, ...rest } = state.memberships;
            const { [chatId]: __, ...restMessages } = state.messages;
            const { [chatId]: ___, ...restReactions } = state.reactions;
            return {
              memberships: rest,
              messages: restMessages,
              reactions: restReactions,
              chats: state.chats.filter((c) => c.id !== chatId),
              activeChatId:
                state.activeChatId === chatId ? null : state.activeChatId,
            };
          },
          false,
          "removeMembership"
        ),

      setReadReceipts: (chatId, receipts) =>
        set(
          (state) => ({
            readReceipts: { ...state.readReceipts, [chatId]: receipts },
          }),
          false,
          "setReadReceipts"
        ),

      setUnreadCounts: (counts) =>
        set(
          () => ({ unreadCounts: counts }),
          false,
          "setUnreadCounts"
        ),

      setUnreadCount: (chatId, count) =>
        set(
          (state) => {
            if (count <= 0) {
              if (!state.unreadCounts[chatId]) return state;
              const { [chatId]: _, ...rest } = state.unreadCounts;
              return { unreadCounts: rest };
            }
            return {
              unreadCounts: { ...state.unreadCounts, [chatId]: count },
            };
          },
          false,
          "setUnreadCount"
        ),

      incrementUnread: (chatId) =>
        set(
          (state) => ({
            unreadCounts: {
              ...state.unreadCounts,
              [chatId]: (state.unreadCounts[chatId] ?? 0) + 1,
            },
          }),
          false,
          "incrementUnread"
        ),

      clearUnread: (chatId) =>
        set(
          (state) => {
            if (!state.unreadCounts[chatId]) return state;
            const { [chatId]: _, ...rest } = state.unreadCounts;
            return { unreadCounts: rest };
          },
          false,
          "clearUnread"
        ),

      setHasMore: (chatId, value) =>
        set(
          (state) => ({
            hasMoreMessages: { ...state.hasMoreMessages, [chatId]: value },
          }),
          false,
          "setHasMore"
        ),

      setLoading: (key, value) =>
        set(
          (state) => ({ loading: { ...state.loading, [key]: value } }),
          false,
          `setLoading/${key}`
        ),

      setError: (key, value) =>
        set(
          (state) => ({ error: { ...state.error, [key]: value } }),
          false,
          `setError/${key}`
        ),

      bumpChatToTop: (chatId) =>
        set(
          (state) => {
            const idx = state.chats.findIndex((c) => c.id === chatId);
            if (idx <= 0) return state; // already first or not found
            const chat = state.chats[idx];
            if (chat.isSelfChat) return state; // self-chat stays pinned, no reorder needed
            // Find insertion point: after self-chats, before other non-self chats
            const firstNonSelf = state.chats.findIndex((c) => !c.isSelfChat);
            const insertAt = firstNonSelf === -1 ? 0 : firstNonSelf;
            if (idx === insertAt) return state;
            const next = [...state.chats];
            next.splice(idx, 1);
            next.splice(insertAt, 0, chat);
            return { chats: next };
          },
          false,
          "bumpChatToTop"
        ),

      setStarredMessageIds: (ids) =>
        set(() => ({ starredMessageIds: ids }), false, "setStarredMessageIds"),

      toggleStarredMessage: (messageId) =>
        set(
          (state) => {
            const next = new Set(state.starredMessageIds);
            next.has(messageId) ? next.delete(messageId) : next.add(messageId);
            return { starredMessageIds: next };
          },
          false,
          "toggleStarredMessage"
        ),

      setBlockedUserIds: (ids) =>
        set(() => ({ blockedUserIds: ids }), false, "setBlockedUserIds"),

      toggleBlockedUser: (userId) =>
        set(
          (state) => {
            const next = new Set(state.blockedUserIds);
            next.has(userId) ? next.delete(userId) : next.add(userId);
            return { blockedUserIds: next };
          },
          false,
          "toggleBlockedUser"
        ),

      reset: () => set(initialState, false, "reset"),
    }),
    { name: "ChatStore" }
  )
);

// --- Selectors (memoization-friendly, use outside store definition) ---

const EMPTY_MESSAGES: Message[] = [];
const EMPTY_REACTIONS: Reaction[] = [];
const EMPTY_RECEIPTS: ReadReceiptEntry[] = [];

export const selectActiveChat = (state: ChatState) =>
  state.chats.find((c) => c.id === state.activeChatId) ?? null;

export const selectActiveMessages = (state: ChatState) =>
  state.activeChatId
    ? (state.messages[state.activeChatId] ?? EMPTY_MESSAGES)
    : EMPTY_MESSAGES;

export const selectActiveReactions = (state: ChatState) =>
  state.activeChatId
    ? (state.reactions[state.activeChatId] ?? EMPTY_REACTIONS)
    : EMPTY_REACTIONS;

export const selectActiveReadReceipts = (state: ChatState) =>
  state.activeChatId
    ? (state.readReceipts[state.activeChatId] ?? EMPTY_RECEIPTS)
    : EMPTY_RECEIPTS;

/** Group reactions by messageId → emoji → { count, users[] } */
export function groupReactions(
  reactions: Reaction[]
): Record<string, ReactionGroup> {
  const grouped: Record<string, ReactionGroup> = {};
  for (const r of reactions) {
    if (!grouped[r.messageId]) grouped[r.messageId] = {};
    const msgGroup = grouped[r.messageId];
    if (!msgGroup[r.emoji]) msgGroup[r.emoji] = { count: 0, users: [] };
    msgGroup[r.emoji].count++;
    msgGroup[r.emoji].users.push(r.userId);
  }
  return grouped;
}

export const selectUserRole = (chatId: string) => (state: ChatState) =>
  state.memberships[chatId] ?? null;

export const selectCanWrite = (chatId: string) => (state: ChatState) => {
  const role = state.memberships[chatId];
  return role === "write" || role === "admin";
};

export const selectIsAdmin = (chatId: string) => (state: ChatState) =>
  state.memberships[chatId] === "admin";

const EMPTY_ATTACHMENTS: AttachmentWithUrl[] = [];
export const selectAttachments = (chatId: string, messageId: string) => (state: ChatState) =>
  state.attachments[chatId]?.[messageId] ?? EMPTY_ATTACHMENTS;
