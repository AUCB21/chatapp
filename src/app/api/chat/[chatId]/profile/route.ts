import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { getUserRole, upsertChatUserProfile } from "@/db/queries/memberships";
import { unauthorized, forbidden, ok, badRequest, serverError } from "@/lib/apiResponse";
import { z } from "zod";

const updateSchema = z.object({
  userId: z.string().uuid().optional(), // default: self; only admins can set others
  displayName: z.string().min(1).max(80).trim().nullable(),
});

type Params = { params: Promise<{ chatId: string }> };

/**
 * PATCH /api/chat/[chatId]/profile
 * Set or clear a per-chat display name override.
 * - Any member can set their own.
 * - Admins can set anyone's.
 * - Send displayName: null to clear the override and fall back to global profile.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const { chatId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0].message);

  const targetUserId = parsed.data.userId ?? user.id;
  const isSelf = targetUserId === user.id;

  try {
    const role = await getUserRole(user.id, chatId);
    if (!role) return forbidden("Not a member of this chat");

    if (!isSelf && role !== "admin") {
      return forbidden("Only admins can set other members' display names");
    }

    await upsertChatUserProfile(chatId, targetUserId, parsed.data.displayName);
    return ok({ updated: true });
  } catch (error) {
    return serverError("Failed to update chat profile", error);
  }
}
