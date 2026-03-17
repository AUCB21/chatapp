import { getAuthUser } from "@/lib/supabaseServer";
import { getUserRole } from "@/db/queries/memberships";
import { db } from "@/db";
import { contacts, userProfiles, memberships } from "@/db/schema";
import { eq, and, notExists } from "drizzle-orm";
import { ok, unauthorized, forbidden, serverError } from "@/lib/apiResponse";

type Params = { params: Promise<{ chatId: string }> };

/**
 * GET /api/chat/[chatId]/invite-candidates
 * Returns the current user's contacts who are NOT already members of this chat.
 * Used by InviteModal to show a searchable list of invitable friends.
 */
export async function GET(_req: Request, { params }: Params) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const { chatId } = await params;

  try {
    const role = await getUserRole(user.id, chatId);
    if (!role) return forbidden();
    if (role !== "admin") return forbidden("Admin permission required");

    const rows = await db
      .select({
        userId: contacts.contactId,
        displayName: userProfiles.displayName,
        username: userProfiles.username,
        avatarUrl: userProfiles.avatarUrl,
      })
      .from(contacts)
      .innerJoin(userProfiles, eq(userProfiles.userId, contacts.contactId))
      .where(
        and(
          eq(contacts.ownerId, user.id),
          notExists(
            db
              .select({ one: memberships.userId })
              .from(memberships)
              .where(
                and(
                  eq(memberships.chatId, chatId),
                  eq(memberships.userId, contacts.contactId)
                )
              )
          )
        )
      )
      .orderBy(userProfiles.displayName);

    return ok({ data: rows });
  } catch (error) {
    return serverError("Failed to fetch invite candidates", error);
  }
}
