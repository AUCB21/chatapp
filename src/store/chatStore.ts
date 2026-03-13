import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { Chat, Message, MemberRole, Reaction } from "../db/schema";

// --- Types ---

export type ChatRole = MemberRole | "pending";
export type ChatWithRole = Chat & { role: ChatRole };

/** Grouped reactions for a message: emoji → { count, users[] } */
export type ReactionGroup = Record<string, { count: number; users: string[] }>;

export interface ChatState {
  // Data
  chats: ChatWithRole[];
  activeChatId: string | null;
  messages: Record<string, Message[]>; // keyed by chatId
  memberships: Record<string, ChatRole>; // chatId → user's role (incl. "pending")
  reactions: Record<string, Reaction[]>; // keyed by chatId

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
  setChats: (chats: ChatWithRole[]) => void;
  setActiveChat: (chatId: string) => void;
  setMessages: (chatId: string, messages: Message[]) => void;
  appendMessage: (chatId: string, message: Message) => void;
  updateMessage: (chatId: string, messageId: string, updates: Partial<Message>) => void;
  setReactions: (chatId: string, reactions: Reaction[]) => void;
  addReaction: (chatId: string, reaction: Reaction) => void;
  removeReaction: (chatId: string, reactionId: string) => void;
  setMembership: (chatId: string, role: ChatRole) => void;
  removeMembership: (chatId: string) => void;
  setLoading: (key: keyof ChatState["loading"], value: boolean) => void;
  setError: (key: keyof ChatState["error"], value: string | null) => void;
  reset: () => void;
}

// --- Initial state ---

const initialState = {
  chats: [],
  activeChatId: null,
  messages: {},
  memberships: {},
  reactions: {},
  loading: { chats: false, messages: false },
  error: { chats: null, messages: null },
};

// --- Store ---

export const useChatStore = create<ChatState>()(
  devtools(
    (set) => ({
      ...initialState,

      setChats: (chats) =>
        set(
          (state) => ({
            chats,
            // Sync memberships map from chats list (includes "pending")
            memberships: chats.reduce(
              (acc, c) => ({ ...acc, [c.id]: c.role }),
              state.memberships
            ),
          }),
          false,
          "setChats"
        ),

      setActiveChat: (chatId) =>
        set({ activeChatId: chatId }, false, "setActiveChat"),

      setMessages: (chatId, messages) =>
        set(
          (state) => ({ messages: { ...state.messages, [chatId]: messages } }),
          false,
          "setMessages"
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

      reset: () => set(initialState, false, "reset"),
    }),
    { name: "ChatStore" }
  )
);

// --- Selectors (memoization-friendly, use outside store definition) ---

const EMPTY_MESSAGES: Message[] = [];
const EMPTY_REACTIONS: Reaction[] = [];

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
