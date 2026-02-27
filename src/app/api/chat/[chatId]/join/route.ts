import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import {
  acceptInvitationByChatAndEmail,
  declineInvitationByChatAndEmail,
} from "@/db/queries/invitations";
import {
  ok,
  unauthorized,
  forbidden,
  notFound,
  serverError,
} from "@/lib/apiResponse";

type Params = { params: Promise<{ chatId: string }> };

/**
 * POST /api/chat/[chatId]/join
 * Accepts a pending invitation — adds the current user as a write member.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const { chatId } = await params;

  try {
    const result = await acceptInvitationByChatAndEmail(
      chatId,
      user.id,
      user.email ?? ""
    );

    if ("error" in result) {
      if (result.error === "No pending invitation found") return notFound(result.error);
      return forbidden(result.error);
    }

    return ok({ chatId });
  } catch {
    return serverError();
  }
}

/**
 * DELETE /api/chat/[chatId]/join
 * Declines a pending invitation — removes it without adding the user.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const { chatId } = await params;

  try {
    const result = await declineInvitationByChatAndEmail(chatId, user.email ?? "");

    if ("error" in result) {
      if (result.error === "No pending invitation found") return notFound(result.error);
      return forbidden(result.error);
    }

    return ok({ declined: true });
  } catch {
    return serverError();
  }
}
