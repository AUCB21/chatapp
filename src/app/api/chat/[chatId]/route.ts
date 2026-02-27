import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { getChatById } from "@/db/queries/chats";
import { getUserRole } from "@/db/queries/memberships";
import { ok, unauthorized, forbidden, notFound, serverError } from "@/lib/apiResponse";

type Params = { params: Promise<{ chatId: string }> };

/**
 * GET /api/chat/[chatId]
 * Returns chat metadata if the user is a member.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const { chatId } = await params;

  try {
    const role = await getUserRole(user.id, chatId);
    if (!role) return forbidden();

    const chat = await getChatById(chatId);
    if (!chat) return notFound();

    return ok({ ...chat, role });
  } catch {
    return serverError();
  }
}
