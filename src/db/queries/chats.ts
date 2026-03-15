import { eq, ne, and, inArray, sql } from "drizzle-orm";
import { db } from "../index";
import { chats, memberships, userProfiles, invitations, chatUserProfiles } from "../schema";

/**
 * Returns all chats the user is a member of, with their type and membership data.
 */
export async function getAccessibleChats(userId: string) {
  return db
    .select({
      id: chats.id,
      name: chats.name,
      type: chats.type,
      createdAt: chats.createdAt,
      role: memberships.role,
      unreadCount: memberships.unreadCount,
    })
    .from(chats)
    .innerJoin(memberships, eq(memberships.chatId, chats.id))
    .where(eq(memberships.userId, userId));
}

/**
 * For a list of direct chat IDs, returns a map of chatId → display name.
 * Prefers the other member's profile display name; falls back to their
 * invited email (for chats where they haven't accepted yet).
 */
export async function getDirectChatPartnerNames(
  chatIds: string[],
  currentUserId: string
): Promise<Record<string, string>> {
  if (chatIds.length === 0) return {};

  const names: Record<string, string> = {};

  // 1. Other members who have accepted — prefer per-chat override > global profile
  const joined = await db
    .select({
      chatId: memberships.chatId,
      chatDisplayName: chatUserProfiles.displayName,
      globalDisplayName: userProfiles.displayName,
    })
    .from(memberships)
    .leftJoin(
      chatUserProfiles,
      and(
        eq(chatUserProfiles.chatId, memberships.chatId),
        eq(chatUserProfiles.userId, memberships.userId)
      )
    )
    .leftJoin(userProfiles, eq(userProfiles.userId, memberships.userId))
    .where(
      and(
        inArray(memberships.chatId, chatIds),
        ne(memberships.userId, currentUserId)
      )
    );

  for (const row of joined) {
    names[row.chatId] = row.chatDisplayName ?? row.globalDisplayName ?? "User";
  }

  // 2. Invited email as fallback (other person hasn't joined yet)
  const invited = await db
    .select({ chatId: invitations.chatId, invitedEmail: invitations.invitedEmail })
    .from(invitations)
    .where(
      and(
        inArray(invitations.chatId, chatIds),
        eq(invitations.invitedByUserId, currentUserId)
      )
    );

  for (const row of invited) {
    if (!names[row.chatId]) {
      names[row.chatId] = row.invitedEmail;
    }
  }

  return names;
}

/**
 * Creates a group chat and assigns creator as admin.
 * Use createChatWithInvitation for chats created via invite flow.
 */
export async function createChat(name: string, creatorId: string) {
  return db.transaction(async (tx) => {
    const [chat] = await tx.insert(chats).values({ name, type: "group" }).returning();

    await tx.insert(memberships).values({
      userId: creatorId,
      chatId: chat.id,
      role: "admin",
    });

    return chat;
  });
}

/**
 * Returns a single chat by ID (no membership check — use getUserRole for that).
 */
export async function getChatById(chatId: string) {
  const result = await db
    .select()
    .from(chats)
    .where(eq(chats.id, chatId))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Returns or creates the user's personal "Saved Messages" chat.
 * A self-chat is a direct chat where the user is the only member.
 */
export async function getOrCreateSelfChat(userId: string) {
  // Find existing self-chat: a direct chat where this user is the only member
  const existing = await db.execute(sql`
    SELECT c.id, c.name, c.type, c.created_at
    FROM chats c
    INNER JOIN memberships m ON m.chat_id = c.id
    WHERE c.type = 'direct'
      AND m.user_id = ${userId}
      AND (SELECT COUNT(*) FROM memberships m2 WHERE m2.chat_id = c.id) = 1
    LIMIT 1
  `);

  const row = (existing as unknown as Array<{
    id: string; name: string | null; type: string; created_at: Date;
  }>)[0];

  if (row) {
    return { id: row.id, name: row.name, type: row.type as "direct", createdAt: new Date(row.created_at) };
  }

  // Create self-chat
  return db.transaction(async (tx) => {
    const [chat] = await tx.insert(chats).values({ name: null, type: "direct" }).returning();
    await tx.insert(memberships).values({ userId, chatId: chat.id, role: "admin" });
    return chat;
  });
}

/**
 * Updates a chat's name. Returns the updated chat or null if not found.
 */
export async function updateChatName(chatId: string, name: string) {
  const [updated] = await db
    .update(chats)
    .set({ name })
    .where(eq(chats.id, chatId))
    .returning();

  return updated ?? null;
}

/**
 * Hard-deletes a chat. Cascade removes memberships, messages, reactions, etc.
 */
export async function deleteChat(chatId: string) {
  const [deleted] = await db
    .delete(chats)
    .where(eq(chats.id, chatId))
    .returning();

  return deleted ?? null;
}
