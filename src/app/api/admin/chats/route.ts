import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { isGlobalAdmin, adminListChats, adminDeleteChat } from "@/db/queries/admin";
import { ok, unauthorized, forbidden, badRequest, notFound, serverError } from "@/lib/apiResponse";
import { z } from "zod";

const deleteSchema = z.object({ chatId: z.string().uuid() });

/**
 * GET /api/admin/chats
 * Returns paginated list of all chats with member count.
 */
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  if (!(await isGlobalAdmin(user.id))) return forbidden();

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
  const offset = Number(url.searchParams.get("offset") ?? 0);

  try {
    const chatList = await adminListChats(limit, offset);
    return ok({ chats: chatList });
  } catch (error) {
    return serverError("Failed to list chats", error);
  }
}

/**
 * DELETE /api/admin/chats
 * Deletes a chat (cascades to messages, memberships, etc.).
 * Body: { chatId: string }
 */
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  if (!(await isGlobalAdmin(user.id))) return forbidden();

  const body = await req.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0].message);

  try {
    const deleted = await adminDeleteChat(parsed.data.chatId);
    if (!deleted) return notFound("Chat not found");
    return ok({ deleted: true, chatId: parsed.data.chatId });
  } catch (error) {
    return serverError("Failed to delete chat", error);
  }
}
