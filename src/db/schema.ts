import {
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
  primaryKey,
  index,
  boolean,
} from "drizzle-orm/pg-core";

// --- Enums ---

export const memberRoleEnum = pgEnum("member_role", ["read", "write", "admin"]);
export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "declined",
]);
export const messageStatusEnum = pgEnum("message_status", [
  "sent",
  "delivered",
  "read",
]);

// --- Tables ---

/**
 * chats: global chat rooms.
 */
export const chats = pgTable("chats", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * memberships: the "have_access" table.
 * userId references auth.users(id) — FK declared in SQL (see migrations).
 * Drizzle does not manage the auth schema.
 */
export const memberships = pgTable(
  "memberships",
  {
    userId: uuid("user_id").notNull(), // FK → auth.users(id), set in SQL
    chatId: uuid("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    role: memberRoleEnum("role").notNull().default("read"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.chatId] }),
    chatIdx: index("memberships_chat_idx").on(t.chatId),
  })
);

/**
 * messages: membership is the sole access condition.
 * userId references auth.users(id) — FK declared in SQL (see migrations).
 */
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    chatId: uuid("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(), // FK → auth.users(id), set in SQL
    content: text("content").notNull(),
    status: messageStatusEnum("status").notNull().default("sent"),
    parentId: uuid("parent_id"), // FK → messages(id), for threaded replies
    editedAt: timestamp("edited_at"),
    deletedAt: timestamp("deleted_at"), // soft delete
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    chatIdx: index("messages_chat_idx").on(t.chatId),
    userIdx: index("messages_user_idx").on(t.userId),
    parentIdx: index("messages_parent_idx").on(t.parentId),
  })
);

/**
 * read_receipts: tracks when a user last read messages in a chat.
 */
export const readReceipts = pgTable(
  "read_receipts",
  {
    userId: uuid("user_id").notNull(),
    chatId: uuid("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("last_read_at").defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.chatId] }),
  })
);

/**
 * reactions: emoji reactions on messages.
 */
export const reactions = pgTable(
  "reactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    emoji: text("emoji").notNull(), // e.g. "👍", "❤️", "😂"
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    messageIdx: index("reactions_message_idx").on(t.messageId),
    uniqueReaction: index("reactions_unique_idx").on(t.messageId, t.userId, t.emoji),
  })
);

/**
 * invitations: email invitations to join a chat.
 * Chat is created immediately; invitee joins on acceptance.
 */
export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    chatId: uuid("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    invitedByUserId: uuid("invited_by_user_id").notNull(), // FK → auth.users(id)
    invitedEmail: text("invited_email").notNull(),
    token: text("token").notNull().unique(),
    status: invitationStatusEnum("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    tokenIdx: index("invitations_token_idx").on(t.token),
    chatIdx: index("invitations_chat_idx").on(t.chatId),
  })
);

export type Chat = typeof chats.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;
export type ReadReceipt = typeof readReceipts.$inferSelect;
export type Reaction = typeof reactions.$inferSelect;
export type MemberRole = (typeof memberRoleEnum.enumValues)[number];
export type InvitationStatus = (typeof invitationStatusEnum.enumValues)[number];
export type MessageStatus = (typeof messageStatusEnum.enumValues)[number];

// Auth user type — sourced from Supabase, not Drizzle
export type AuthUser = {
  id: string;
  email: string;
  created_at: string;
};
