import { eq, sql } from "drizzle-orm";
import { db } from "../index";
import { userProfiles, type UserProfile, type UserStatus } from "../schema";
import { getOrCreateSelfChat } from "./chats";

/**
 * Returns the user's profile, creating a default one if it doesn't exist.
 * The default username and displayName are derived from the user's email.
 */
export async function getOrCreateProfile(
  userId: string,
  email: string
): Promise<UserProfile> {
  const existing = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  if (existing[0]) return existing[0];

  // Create default profile — username = email prefix, displayName = username
  const username = email.split("@")[0];
  const [created] = await db
    .insert(userProfiles)
    .values({
      userId,
      username,
      displayName: username,
    })
    .onConflictDoNothing()
    .returning();

  // If conflict (race condition), re-fetch
  if (!created) {
    const [refetched] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);
    return refetched;
  }

  // Auto-create personal "Saved Messages" chat for new users
  await getOrCreateSelfChat(userId).catch(() => {});

  return created;
}

/**
 * Updates specific fields on the user's profile.
 * Only provided fields are updated; nulls/undefineds are skipped.
 */
export async function updateProfile(
  userId: string,
  updates: {
    username?: string;
    displayName?: string;
    avatarUrl?: string | null;
    status?: UserStatus;
    accentBg?: string | null;
    accentFont?: string | null;
    accentChat?: string | null;
  }
): Promise<UserProfile> {
  const [updated] = await db
    .update(userProfiles)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(userProfiles.userId, userId))
    .returning();

  return updated;
}

/**
 * Deletes a user's profile (used during account deletion).
 */
export async function deleteProfile(userId: string) {
  return db.delete(userProfiles).where(eq(userProfiles.userId, userId));
}
