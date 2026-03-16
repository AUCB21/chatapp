import { eq, count, sql } from "drizzle-orm";
import { db } from "../index";
import { userProfiles, chats, memberships, messages } from "../schema";

/**
 * Check if a user has the global admin flag set.
 */
export async function isGlobalAdmin(userId: string): Promise<boolean> {
  const rows = await db
    .select({ isAdmin: userProfiles.isAdmin })
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);
  return rows[0]?.isAdmin === true;
}

/**
 * List all user profiles (paginated).
 */
export async function adminListUsers(limit = 50, offset = 0) {
  return db
    .select({
      userId: userProfiles.userId,
      username: userProfiles.username,
      displayName: userProfiles.displayName,
      avatarUrl: userProfiles.avatarUrl,
      status: userProfiles.status,
      isAdmin: userProfiles.isAdmin,
      createdAt: userProfiles.createdAt,
    })
    .from(userProfiles)
    .orderBy(userProfiles.createdAt)
    .limit(limit)
    .offset(offset);
}

/**
 * List all chats with member count (paginated).
 */
export async function adminListChats(limit = 50, offset = 0) {
  return db
    .select({
      id: chats.id,
      name: chats.name,
      type: chats.type,
      createdAt: chats.createdAt,
      memberCount: count(memberships.userId),
    })
    .from(chats)
    .leftJoin(memberships, eq(memberships.chatId, chats.id))
    .groupBy(chats.id, chats.name, chats.type, chats.createdAt)
    .orderBy(chats.createdAt)
    .limit(limit)
    .offset(offset);
}

/**
 * Delete a chat by ID (cascades to messages, memberships, etc. via FK).
 */
export async function adminDeleteChat(chatId: string) {
  const rows = await db
    .delete(chats)
    .where(eq(chats.id, chatId))
    .returning({ id: chats.id });
  return rows[0] ?? null;
}

/**
 * Aggregate usage stats.
 */
export async function adminGetStats() {
  const [[userRow], [chatRow], [msgRow]] = await Promise.all([
    db.select({ total: count() }).from(userProfiles),
    db.select({ total: count() }).from(chats),
    db
      .select({ total: count() })
      .from(messages)
      .where(sql`${messages.deletedAt} IS NULL`),
  ]);
  return {
    users: userRow?.total ?? 0,
    chats: chatRow?.total ?? 0,
    messages: msgRow?.total ?? 0,
  };
}
