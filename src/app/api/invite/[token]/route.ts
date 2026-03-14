import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import {
  acceptInvitationByToken,
  getPendingInvitationByToken,
} from "@/db/queries/invitations";
import {
  ok,
  unauthorized,
  forbidden,
  notFound,
  serverError,
} from "@/lib/apiResponse";

type Params = { params: Promise<{ token: string }> };

/**
 * GET /api/invite/[token]
 * Validates a token invitation and returns preview metadata.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const { token } = await params;

  try {
    const invitation = await getPendingInvitationByToken(token);
    if (!invitation) return notFound("Invitation not found");
    if (invitation.status !== "pending") {
      return forbidden("Invitation is no longer pending");
    }
    if (invitation.expiresAt.getTime() <= Date.now()) {
      return forbidden("Invitation has expired");
    }

    const displayName =
      invitation.chatType === "direct"
        ? "Direct Message"
        : (invitation.chatName ?? "Group Chat");

    return ok({
      chatId: invitation.chatId,
      chatName: displayName,
      expiresAt: invitation.expiresAt,
    });
  } catch (error) {
    return serverError("Failed to validate invitation", error);
  }
}

/**
 * POST /api/invite/[token]
 * Accepts a token invitation and adds the current user to the chat.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const { token } = await params;

  try {
    const result = await acceptInvitationByToken(token, user.id);
    if ("error" in result) {
      if (result.error === "Invitation not found") return notFound(result.error);
      return forbidden(result.error);
    }

    return ok({ accepted: true, chatId: result.chatId });
  } catch (error) {
    return serverError("Failed to accept invitation", error);
  }
}
