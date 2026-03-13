import { eq } from "drizzle-orm";
import { db } from "../index";
import { chats, memberships } from "../schema";

/**
 * Returns all chats the user is a member of.
 * Joins memberships so we only return accessible chats.
 */
export async function getAccessibleChats(userId: string) {
  return db
    .select({
      id: chats.id,
      name: chats.name,
      createdAt: chats.createdAt,
      role: memberships.role,
      unreadCount: memberships.unreadCount,
    })
    .from(chats)
    .innerJoin(memberships, eq(memberships.chatId, chats.id))
    .where(eq(memberships.userId, userId));
}

/**
 * Creates a chat and assigns creator as admin.
 */
export async function createChat(name: string, creatorId: string) {
  return db.transaction(async (tx) => {
    const [chat] = await tx.insert(chats).values({ name }).returning();

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
 * Hard-deletes a chat. Cascade removes memberships, messages, reactions, etc.
 */
export async function deleteChat(chatId: string) {
  const [deleted] = await db
    .delete(chats)
    .where(eq(chats.id, chatId))
    .returning();

  return deleted ?? null;
}
