import { and, eq, sql } from "drizzle-orm";
import { db } from "../index";
import { memberships, type MemberRole } from "../schema";

export interface ChatMember {
  userId: string;
  email: string;
  role: MemberRole;
  joinedAt: Date;
}

/**
 * Returns all members of a chat with their email from auth.users.
 */
export async function getChatMembers(chatId: string): Promise<ChatMember[]> {
  const rows = await db.execute(sql`
    SELECT m.user_id, u.email, m.role, m.created_at AS joined_at
    FROM memberships m
    JOIN auth.users u ON u.id = m.user_id
    WHERE m.chat_id = ${chatId}
    ORDER BY
      CASE m.role WHEN 'admin' THEN 0 WHEN 'write' THEN 1 ELSE 2 END,
      m.created_at
  `);

  return (rows as unknown as Array<{ user_id: string; email: string; role: MemberRole; joined_at: Date }>).map(
    (r) => ({
      userId: r.user_id,
      email: r.email,
      role: r.role,
      joinedAt: new Date(r.joined_at),
    })
  );
}

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
