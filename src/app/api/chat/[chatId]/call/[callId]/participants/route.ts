import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { getUserRole } from "@/db/queries/memberships";
import {
  getActiveCallForChat,
  joinCallSession,
  leaveCallSession,
  setParticipantMute,
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

type Params = { params: Promise<{ chatId: string; callId: string }> };

/**
 * POST /api/chat/[chatId]/call/[callId]/participants
 * Join the given call session as the current user.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const { chatId, callId } = await params;

  try {
    const role = await getUserRole(user.id, chatId);
    if (!role) return forbidden();

    const activeCall = await getActiveCallForChat(chatId);
    if (!activeCall || activeCall.id !== callId) {
      return notFound("Call not found or no longer active");
    }

    const participant = await joinCallSession(callId, user.id);
    return created({ participant });
  } catch (error) {
    return serverError("Failed to join call", error);
  }
}

/**
 * PATCH /api/chat/[chatId]/call/[callId]/participants
 * Update participant media state for current user.
 * Body: { isMuted: boolean }
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const { chatId, callId } = await params;

  try {
    const role = await getUserRole(user.id, chatId);
    if (!role) return forbidden();

    const body = await req.json().catch(() => null);
    if (!body || typeof body.isMuted !== "boolean") {
      return badRequest("isMuted (boolean) is required");
    }

    const participant = await setParticipantMute(callId, user.id, body.isMuted);
    if (!participant) return notFound("Participant not found");

    return ok({ participant });
  } catch (error) {
    return serverError("Failed to update participant", error);
  }
}

/**
 * DELETE /api/chat/[chatId]/call/[callId]/participants
 * Leave the call as current user.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const { chatId, callId } = await params;

  try {
    const role = await getUserRole(user.id, chatId);
    if (!role) return forbidden();

    await leaveCallSession(callId, user.id);
    return ok({ left: callId });
  } catch (error) {
    return serverError("Failed to leave call", error);
  }
}
