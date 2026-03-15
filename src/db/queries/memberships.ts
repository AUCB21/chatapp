import { and, eq, sql } from "drizzle-orm";
import { db } from "../index";
import { memberships, chatUserProfiles, type MemberRole } from "../schema";

export interface ChatMember {
  userId: string;
  email: string;
  role: MemberRole;
  joinedAt: Date;
  /** Per-chat override > global profile > email prefix */
  displayName: string;
  /** Per-chat display name (null if not set) */
  chatDisplayName: string | null;
  /** Global profile display name (null if no profile) */
  globalDisplayName: string | null;
}

/**
 * Returns all members of a chat with effective display names.
 * Priority: chat_user_profiles.display_name > user_profiles.display_name > email prefix.
 */
export async function getChatMembers(chatId: string): Promise<ChatMember[]> {
  const rows = await db.execute(sql`
    SELECT
      m.user_id,
      u.email,
      m.role,
      m.created_at AS joined_at,
      cup.display_name AS chat_display_name,
      up.display_name AS global_display_name
    FROM memberships m
    JOIN auth.users u ON u.id = m.user_id
    LEFT JOIN chat_user_profiles cup ON cup.chat_id = m.chat_id AND cup.user_id = m.user_id
    LEFT JOIN user_profiles up ON up.user_id = m.user_id
    WHERE m.chat_id = ${chatId}
    ORDER BY
      CASE m.role WHEN 'admin' THEN 0 WHEN 'write' THEN 1 ELSE 2 END,
      m.created_at
  `);

  return (rows as unknown as Array<{
    user_id: string;
    email: string;
    role: MemberRole;
    joined_at: Date;
    chat_display_name: string | null;
    global_display_name: string | null;
  }>).map((r) => ({
    userId: r.user_id,
    email: r.email,
    role: r.role,
    joinedAt: new Date(r.joined_at),
    chatDisplayName: r.chat_display_name,
    globalDisplayName: r.global_display_name,
    displayName:
      r.chat_display_name ??
      r.global_display_name ??
      r.email.split("@")[0],
  }));
}

/**
 * Returns a paginated list of chat members using cursor-based pagination.
 * The cursor is the `joinedAt` ISO string of the last member from the previous page.
 */
export async function getChatMembersPaginated(
  chatId: string,
  limit: number = 20,
  cursor?: string
): Promise<{ members: ChatMember[]; nextCursor: string | null }> {
  const cursorClause = cursor
    ? sql`AND (
        CASE m.role WHEN 'admin' THEN 0 WHEN 'write' THEN 1 ELSE 2 END,
        m.created_at
      ) > (
        SELECT
          CASE m2.role WHEN 'admin' THEN 0 WHEN 'write' THEN 1 ELSE 2 END,
          m2.created_at
        FROM memberships m2
        WHERE m2.chat_id = ${chatId} AND m2.created_at = ${cursor}
        LIMIT 1
      )`
    : sql``;

  const rows = await db.execute(sql`
    SELECT
      m.user_id,
      u.email,
      m.role,
      m.created_at AS joined_at,
      cup.display_name AS chat_display_name,
      up.display_name AS global_display_name
    FROM memberships m
    JOIN auth.users u ON u.id = m.user_id
    LEFT JOIN chat_user_profiles cup ON cup.chat_id = m.chat_id AND cup.user_id = m.user_id
    LEFT JOIN user_profiles up ON up.user_id = m.user_id
    WHERE m.chat_id = ${chatId}
    ${cursorClause}
    ORDER BY
      CASE m.role WHEN 'admin' THEN 0 WHEN 'write' THEN 1 ELSE 2 END,
      m.created_at
    LIMIT ${limit + 1}
  `);

  const allRows = (rows as unknown as Array<{
    user_id: string;
    email: string;
    role: MemberRole;
    joined_at: Date;
    chat_display_name: string | null;
    global_display_name: string | null;
  }>);

  const hasMore = allRows.length > limit;
  const pageRows = hasMore ? allRows.slice(0, limit) : allRows;

  const members: ChatMember[] = pageRows.map((r) => ({
    userId: r.user_id,
    email: r.email,
    role: r.role,
    joinedAt: new Date(r.joined_at),
    chatDisplayName: r.chat_display_name,
    globalDisplayName: r.global_display_name,
    displayName:
      r.chat_display_name ??
      r.global_display_name ??
      r.email.split("@")[0],
  }));

  const nextCursor = hasMore
    ? members[members.length - 1].joinedAt.toISOString()
    : null;

  return { members, nextCursor };
}

/**
 * Returns the user's role in a chat, or null if not a member.
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

/**
 * Sets or clears a per-chat display name override.
 */
export async function upsertChatUserProfile(
  chatId: string,
  userId: string,
  displayName: string | null
) {
  if (displayName === null) {
    await db
      .delete(chatUserProfiles)
      .where(
        and(
          eq(chatUserProfiles.chatId, chatId),
          eq(chatUserProfiles.userId, userId)
        )
      );
    return;
  }

  await db
    .insert(chatUserProfiles)
    .values({ chatId, userId, displayName, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [chatUserProfiles.chatId, chatUserProfiles.userId],
      set: { displayName, updatedAt: new Date() },
    });
}
