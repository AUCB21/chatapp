import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { getUserRole } from "@/db/queries/memberships";
import { addReaction, removeReaction } from "@/db/queries/messages";
import { reactionSchema } from "@/lib/validation";
import {
  ok,
  created,
  unauthorized,
  forbidden,
  badRequest,
  serverError,
} from "@/lib/apiResponse";

type Params = { params: Promise<{ chatId: string }> };

/**
 * POST /api/chat/[chatId]/messages/reactions
 * Add an emoji reaction to a message.
 * Body: { messageId: string, emoji: string }
 */
export async function POST(req: NextRequest, { params }: Params) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const { chatId } = await params;

  try {
    const role = await getUserRole(user.id, chatId);
    if (!role) return forbidden();

    const body = await req.json().catch(() => null);
    if (!body?.messageId) return badRequest("messageId is required");

    const parsed = reactionSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    const reaction = await addReaction(user.id, body.messageId, parsed.data.emoji);
    return created(reaction);
  } catch (error) {
    return serverError("Failed to add reaction", error);
  }
}

/**
 * DELETE /api/chat/[chatId]/messages/reactions
 * Remove an emoji reaction from a message.
 * Body: { messageId: string, emoji: string }
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const { chatId } = await params;

  try {
    const role = await getUserRole(user.id, chatId);
    if (!role) return forbidden();

    const body = await req.json().catch(() => null);
    if (!body?.messageId) return badRequest("messageId is required");

    const parsed = reactionSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    const removed = await removeReaction(user.id, body.messageId, parsed.data.emoji);
    return ok(removed);
  } catch (error) {
    return serverError("Failed to remove reaction", error);
  }
}
