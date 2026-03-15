import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { getChatById, deleteChat, updateChatName } from "@/db/queries/chats";
import { getUserRole, removeMember } from "@/db/queries/memberships";
import { ok, badRequest, unauthorized, forbidden, notFound, serverError } from "@/lib/apiResponse";

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
  } catch (error) {
    return serverError("Failed to fetch chat details", error);
  }
}

/**
 * PATCH /api/chat/[chatId]
 * Updates chat properties. Currently supports renaming group chats (admin only).
 * Body: { name: string }
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const { chatId } = await params;

  try {
    const role = await getUserRole(user.id, chatId);
    if (!role) return forbidden();
    if (role !== "admin") return forbidden("Admin permission required");

    const chat = await getChatById(chatId);
    if (!chat) return notFound();
    if (chat.type !== "group") return badRequest("Cannot rename direct chats");

    const body = await req.json().catch(() => null);
    if (!body?.name || typeof body.name !== "string") return badRequest("name is required");

    const trimmed = body.name.trim();
    if (trimmed.length === 0 || trimmed.length > 100) {
      return badRequest("Name must be 1-100 characters");
    }

    const updated = await updateChatName(chatId, trimmed);
    if (!updated) return notFound();

    return ok(updated);
  } catch (error) {
    return serverError("Failed to update chat", error);
  }
}

/**
 * DELETE /api/chat/[chatId]
 * mode=for_me    → remove caller's membership (leave chat)
 * mode=for_everyone → hard-delete the chat (admin only, cascade)
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const { chatId } = await params;

  try {
    const role = await getUserRole(user.id, chatId);
    if (!role) return forbidden();

    const { mode } = await req.json().catch(() => ({ mode: undefined }));

    if (mode === "for_everyone") {
      if (role !== "admin") return forbidden("Only admins can delete for everyone");
      const deleted = await deleteChat(chatId);
      if (!deleted) return notFound();
      return ok({ deleted: true, mode });
    }

    if (mode === "for_me") {
      await removeMember(user.id, chatId);
      return ok({ deleted: true, mode });
    }

    return badRequest("mode must be 'for_me' or 'for_everyone'");
  } catch (error) {
    return serverError("Failed to delete chat", error);
  }
}
