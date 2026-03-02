import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { getUserRole } from "@/db/queries/memberships";
import {
  getMessages,
  createMessage,
  editMessage,
  deleteMessage,
  markRead,
  getReactionsForChat,
} from "@/db/queries/messages";
import { sendMessageSchema, editMessageSchema } from "@/lib/validation";
import {
  ok,
  created,
  unauthorized,
  forbidden,
  badRequest,
  notFound,
  serverError,
} from "@/lib/apiResponse";

type Params = { params: Promise<{ chatId: string }> };

/**
 * GET /api/chat/[chatId]/messages
 * Returns all messages for the chat (with reactions).
 * Also marks messages as read for the requesting user.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const { chatId } = await params;

  try {
    const role = await getUserRole(user.id, chatId);
    if (!role) return forbidden();

    const [msgs, reactions] = await Promise.all([
      getMessages(user.id, chatId),
      getReactionsForChat(chatId),
    ]);

    // Mark messages as read in background (don't block response)
    markRead(chatId, user.id).catch((e) =>
      console.error("[markRead]", e)
    );

    return ok({ messages: msgs, reactions });
  } catch (error) {
    return serverError("Failed to fetch messages", error);
  }
}

/**
 * POST /api/chat/[chatId]/messages
 * Sends a message. Requires write or admin role.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const { chatId } = await params;

  try {
    const role = await getUserRole(user.id, chatId);
    if (!role) return forbidden();
    if (role === "read") return forbidden("Write permission required");

    const body = await req.json().catch(() => null);
    const parsed = sendMessageSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    const message = await createMessage(
      user.id,
      chatId,
      parsed.data.content,
      parsed.data.parentId
    );
    return created(message);
  } catch (error) {
    return serverError("Failed to send message", error);
  }
}

/**
 * PATCH /api/chat/[chatId]/messages
 * Edits a message. Only the author can edit.
 * Body: { messageId: string, content: string }
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const { chatId } = await params;

  try {
    const role = await getUserRole(user.id, chatId);
    if (!role) return forbidden();

    const body = await req.json().catch(() => null);
    if (!body?.messageId) return badRequest("messageId is required");

    const parsed = editMessageSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    const updated = await editMessage(user.id, body.messageId, parsed.data.content);
    if (!updated) return notFound("Message not found or not yours");

    return ok(updated);
  } catch (error) {
    return serverError("Failed to edit message", error);
  }
}

/**
 * DELETE /api/chat/[chatId]/messages
 * Soft-deletes a message. Only the author can delete.
 * Body: { messageId: string }
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

    const deleted = await deleteMessage(user.id, body.messageId);
    if (!deleted) return notFound("Message not found or not yours");

    return ok(deleted);
  } catch (error) {
    return serverError("Failed to delete message", error);
  }
}
