import { and, eq } from "drizzle-orm";
import { db } from "../index";
import { memberships, type MemberRole } from "../schema";

/**
 * Returns the user's role in a chat, or null if not a member.
 * Use this as the single source of truth for access control.
 */
export async function getUserRole(
  userId: string,
  chatId: string
): Promise<MemberRole | null> {
  const result = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.userId, userId), eq(memberships.chatId, chatId)))
    .limit(1);

  return result[0]?.role ?? null;
}

/**
 * Returns all chats a user is a member of, with their role.
 */
export async function getUserChats(userId: string) {
  return db
    .select({ chatId: memberships.chatId, role: memberships.role })
    .from(memberships)
    .where(eq(memberships.userId, userId));
}

/**
 * Adds a user to a chat with a given role.
 * Upserts to handle re-invites gracefully.
 */
export async function addMember(
  userId: string,
  chatId: string,
  role: MemberRole = "read"
) {
  return db
    .insert(memberships)
    .values({ userId, chatId, role })
    .onConflictDoUpdate({
      target: [memberships.userId, memberships.chatId],
      set: { role },
    });
}

/**
 * Removes a user from a chat.
 */
export async function removeMember(userId: string, chatId: string) {
  return db
    .delete(memberships)
    .where(and(eq(memberships.userId, userId), eq(memberships.chatId, chatId)));
}
