import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { getUserRole, getChatMembers } from "@/db/queries/memberships";
import { getReadReceipts } from "@/db/queries/messages";
import { ok, unauthorized, forbidden, serverError } from "@/lib/apiResponse";

type Params = { params: Promise<{ chatId: string }> };

/**
 * GET /api/chat/[chatId]/read-receipts
 * Returns read receipts for all members with display names.
 * Shape: { userId, displayName, lastReadAt }[]
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const { chatId } = await params;

  try {
    const role = await getUserRole(user.id, chatId);
    if (!role) return forbidden();

    const [receipts, members] = await Promise.all([
      getReadReceipts(chatId),
      getChatMembers(chatId),
    ]);

    const memberMap = new Map(members.map((m) => [m.userId, m.displayName]));

    const data = receipts.map((r) => ({
      userId: r.userId,
      displayName: memberMap.get(r.userId) ?? r.userId,
      lastReadAt: r.lastReadAt,
    }));

    return ok({ receipts: data });
  } catch (error) {
    return serverError("Failed to fetch read receipts", error);
  }
}
