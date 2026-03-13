import { and, eq, asc, desc, inArray, lt, isNull, sql } from "drizzle-orm";
import { db } from "../index";
import {
  deletedForMe,
  messages,
  memberships,
  readReceipts,
  reactions,
} from "../schema";

const DEFAULT_PAGE_SIZE = 50;

function notHiddenForUser(userId: string) {
  return sql`not exists (
    select 1
    from deleted_for_me
    where ${deletedForMe.userId} = ${userId}
      and ${deletedForMe.messageId} = ${messages.id}
  )`;
}

/**
 * Fetches messages for a chat with optional cursor-based pagination.
 * Includes soft-deleted messages so recipients see "[Message deleted]".
 * Returns at most `limit` messages ordered oldest→newest.
 */
export async function getMessages(
  userId: string,
  chatId: string,
  options?: { before?: Date; limit?: number }
) {
  const membership = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.userId, userId), eq(memberships.chatId, chatId)))
    .limit(1);

  if (!membership[0]) return [];

  const limit = options?.limit ?? DEFAULT_PAGE_SIZE;
  const baseWhere = and(eq(messages.chatId, chatId), notHiddenForUser(userId));
  const whereClause = options?.before
    ? and(baseWhere, lt(messages.createdAt, options.before))
    : baseWhere;

  const rows = await db
    .select()
    .from(messages)
    .where(whereClause)
    .orderBy(desc(messages.createdAt))
    .limit(limit);

  // Return in ascending (oldest first) order for display
  return rows.reverse();
}

/**
 * Inserts a message. Requires write or admin role (enforced in API route).
 */
export async function createMessage(
  userId: string,
  chatId: string,
  content: string,
  parentId?: string | null
) {
  const [message] = await db
    .insert(messages)
    .values({ userId, chatId, content, parentId: parentId || null })
    .returning();

  return message;
}

/**
 * Edit a message. Only the author can edit.
 */
export async function editMessage(
  userId: string,
  messageId: string,
  newContent: string
) {
  const [updated] = await db
    .update(messages)
    .set({ content: newContent, editedAt: new Date() })
    .where(and(eq(messages.id, messageId), eq(messages.userId, userId)))
    .returning();

  return updated ?? null;
}

/**
 * Soft-delete a message. Only the author can delete.
 */
export async function deleteMessage(userId: string, messageId: string) {
  const [deleted] = await db
    .update(messages)
    .set({ deletedAt: new Date(), content: "[Message deleted]" })
    .where(and(eq(messages.id, messageId), eq(messages.userId, userId)))
    .returning();

  return deleted ?? null;
}

/**
 * Hides a message for a single user while keeping it visible for others.
 */
export async function hideMessageForUser(
  userId: string,
  chatId: string,
  messageId: string
) {
  const candidate = await db
    .select({ id: messages.id })
    .from(messages)
    .innerJoin(
      memberships,
      and(eq(memberships.chatId, messages.chatId), eq(memberships.userId, userId))
    )
    .where(and(eq(messages.id, messageId), eq(messages.chatId, chatId)))
    .limit(1);

  if (!candidate[0]) return false;

  await db
    .insert(deletedForMe)
    .values({ userId, messageId })
    .onConflictDoNothing();

  return true;
}

/**
 * Persists locally hidden message IDs from previous app versions.
 */
export async function syncDeletedMessagesForUser(
  userId: string,
  messageIds: string[]
) {
  const uniqueIds = [...new Set(messageIds)];
  if (uniqueIds.length === 0) return [];

  const accessible = await db
    .select({ messageId: messages.id })
    .from(messages)
    .innerJoin(
      memberships,
      and(eq(memberships.chatId, messages.chatId), eq(memberships.userId, userId))
    )
    .where(inArray(messages.id, uniqueIds));

  const accessibleIds = [...new Set(accessible.map((row) => row.messageId))];
  if (accessibleIds.length === 0) return [];

  await db
    .insert(deletedForMe)
    .values(accessibleIds.map((messageId) => ({ userId, messageId })))
    .onConflictDoNothing();

  return accessibleIds;
}

/**
 * Update message delivery status.
 */
export async function updateMessageStatus(
  messageId: string,
  status: "delivered" | "read"
) {
  const [updated] = await db
    .update(messages)
    .set({ status })
    .where(eq(messages.id, messageId))
    .returning();

  return updated ?? null;
}

/**
 * Mark messages as delivered when the recipient opens the chat.
 */
export async function markDelivered(chatId: string, userId: string) {
  await db
    .update(messages)
    .set({ status: "delivered" })
    .where(
      and(
        eq(messages.chatId, chatId),
        eq(messages.status, "sent"),
        sql`${messages.userId} != ${userId}`
      )
    );
}

/**
 * Mark messages as read when the user views the chat.
 */
export async function markRead(chatId: string, userId: string) {
  // Update all unread messages in this chat that aren't from this user
  await db
    .update(messages)
    .set({ status: "read" })
    .where(
      and(
        eq(messages.chatId, chatId),
        sql`${messages.status} != 'read'`,
        sql`${messages.userId} != ${userId}`
      )
    );

  // Upsert read receipt
  await db
    .insert(readReceipts)
    .values({ userId, chatId, lastReadAt: new Date() })
    .onConflictDoUpdate({
      target: [readReceipts.userId, readReceipts.chatId],
      set: { lastReadAt: new Date() },
    });

  // Reset unread counter on the membership row
  await db
    .update(memberships)
    .set({ unreadCount: 0 })
    .where(
      and(eq(memberships.chatId, chatId), eq(memberships.userId, userId))
    );
}

/**
 * Get read receipts for a chat.
 */
export async function getReadReceipts(chatId: string) {
  return db
    .select()
    .from(readReceipts)
    .where(eq(readReceipts.chatId, chatId));
}

/**
 * Get reactions for messages in a chat.
 */
export async function getReactionsForChat(chatId: string) {
  return db
    .select({
      id: reactions.id,
      messageId: reactions.messageId,
      userId: reactions.userId,
      emoji: reactions.emoji,
      createdAt: reactions.createdAt,
    })
    .from(reactions)
    .innerJoin(messages, eq(reactions.messageId, messages.id))
    .where(eq(messages.chatId, chatId));
}

/**
 * Add a reaction to a message.
 */
export async function addReaction(
  userId: string,
  messageId: string,
  emoji: string
) {
  const [reaction] = await db
    .insert(reactions)
    .values({ userId, messageId, emoji })
    .onConflictDoNothing()
    .returning();

  return reaction ?? null;
}

/**
 * Remove a reaction from a message.
 */
export async function removeReaction(
  userId: string,
  messageId: string,
  emoji: string
) {
  const [deleted] = await db
    .delete(reactions)
    .where(
      and(
        eq(reactions.userId, userId),
        eq(reactions.messageId, messageId),
        eq(reactions.emoji, emoji)
      )
    )
    .returning();

  return deleted ?? null;
}

/**
 * Search messages by content (case-insensitive ilike).
 */
export async function searchMessages(userId: string, chatId: string, query: string) {
  const membership = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.userId, userId), eq(memberships.chatId, chatId)))
    .limit(1);

  if (!membership[0]) return [];

  return db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.chatId, chatId),
        isNull(messages.deletedAt),
        notHiddenForUser(userId),
        sql`${messages.content} ilike ${"%" + query + "%"}`
      )
    )
    .orderBy(desc(messages.createdAt))
    .limit(50);
}

/**
 * Get thread replies for a parent message.
 */
export async function getThreadReplies(parentId: string) {
  return db
    .select()
    .from(messages)
    .where(and(eq(messages.parentId, parentId), isNull(messages.deletedAt)))
    .orderBy(asc(messages.createdAt));
}

/**
 * Get the reply count for a message.
 */
export async function getReplyCount(parentId: string) {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(messages)
    .where(and(eq(messages.parentId, parentId), isNull(messages.deletedAt)));

  return result?.count ?? 0;
}

