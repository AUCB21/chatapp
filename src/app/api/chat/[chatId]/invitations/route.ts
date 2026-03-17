import { getAuthUser } from "@/lib/supabaseServer";
import { getUserRole } from "@/db/queries/memberships";
import { db } from "@/db";
import { invitations } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { ok, unauthorized, forbidden, serverError } from "@/lib/apiResponse";

type Params = { params: Promise<{ chatId: string }> };

/**
 * GET /api/chat/[chatId]/invitations
 * Admin-only: returns all pending email invitations for this chat.
 * Used by the GroupSettingsSheet Invites tab.
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
        id: invitations.id,
        invitedEmail: invitations.invitedEmail,
        token: invitations.token,
        createdAt: invitations.createdAt,
        expiresAt: invitations.expiresAt,
      })
      .from(invitations)
      .where(
        and(
          eq(invitations.chatId, chatId),
          eq(invitations.status, "pending")
        )
      )
      .orderBy(invitations.createdAt);

    return ok({ data: rows });
  } catch (error) {
    return serverError("Failed to fetch invitations", error);
  }
}
