import { and, eq, asc } from "drizzle-orm";
import { db } from "../index";
import { messages, memberships } from "../schema";

/**
 * Fetches all messages for a chat.
 * Single condition: user must be a member.
 * Returns empty array if not a member (no error leak).
 */
export async function getMessages(userId: string, chatId: string) {
  const membership = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.userId, userId), eq(memberships.chatId, chatId)))
    .limit(1);

  if (!membership[0]) return [];

  return db
    .select()
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(asc(messages.createdAt));
}

/**
 * Inserts a message. Requires write or admin role (enforced in API route).
 */
export async function createMessage(
  userId: string,
  chatId: string,
  content: string
) {
  const [message] = await db
    .insert(messages)
    .values({ userId, chatId, content })
    .returning();

  return message;
}
