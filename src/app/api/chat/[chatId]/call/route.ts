import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { getUserRole } from "@/db/queries/memberships";
import {
  createCallSession,
  endCallSession,
  getActiveCallForChat,
  getCallParticipants,
} from "@/db/queries/calls";
import {
  badRequest,
  created,
  forbidden,
  notFound,
  ok,
  serverError,
  unauthorized,
} from "@/lib/apiResponse";

type Params = { params: Promise<{ chatId: string }> };

/**
 * GET /api/chat/[chatId]/call
 * Returns the active call session (if any) plus participants.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const { chatId } = await params;

  try {
    const role = await getUserRole(user.id, chatId);
    if (!role) return forbidden();

    const activeCall = await getActiveCallForChat(chatId);
    if (!activeCall) return ok({ activeCall: null, participants: [] });

    const participants = await getCallParticipants(activeCall.id);
    return ok({ activeCall, participants });
  } catch (error) {
    return serverError("Failed to fetch active call", error);
  }
}

/**
 * POST /api/chat/[chatId]/call
 * Starts a new call session if none is active.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const { chatId } = await params;

  try {
    const role = await getUserRole(user.id, chatId);
    if (!role) return forbidden();
    if (role === "read") {
      return forbidden("Write permission required to start a call");
    }

    const existing = await getActiveCallForChat(chatId);
    if (existing) {
      const participants = await getCallParticipants(existing.id);
      return ok({ activeCall: existing, participants });
    }

    const activeCall = await createCallSession(chatId, user.id);
    const participants = await getCallParticipants(activeCall.id);

    return created({ activeCall, participants });
  } catch (error) {
    return serverError("Failed to start call", error);
  }
}

/**
 * DELETE /api/chat/[chatId]/call
 * Ends the active call session. Host or chat admin only.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const { chatId } = await params;

  try {
    const role = await getUserRole(user.id, chatId);
    if (!role) return forbidden();

    const activeCall = await getActiveCallForChat(chatId);
    if (!activeCall) return notFound("No active call");

    const isHost = activeCall.createdByUserId === user.id;
    const isChatAdmin = role === "admin";
    if (!isHost && !isChatAdmin) {
      return forbidden("Only host or admin can end the call");
    }

    await endCallSession(activeCall.id);
    return ok({ ended: activeCall.id });
  } catch (error) {
    return serverError("Failed to end call", error);
  }
}
