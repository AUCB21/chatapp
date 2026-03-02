import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { getAccessibleChats, createChat } from "@/db/queries/chats";
import { getPendingInvitationsForEmail } from "@/db/queries/invitations";
import { createChatSchema } from "@/lib/validation";
import { ok, created, unauthorized, badRequest, serverError } from "@/lib/apiResponse";

/**
 * GET /api/chat
 * Returns all chats the user is a member of, plus any pending invitations
 * (visible in the sidebar with role "pending" until accepted/declined).
 */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  try {
    const [memberChats, pendingInvites] = await Promise.all([
      getAccessibleChats(user.id),
      getPendingInvitationsForEmail(user.email ?? ""),
    ]);

    const memberChatIds = new Set(memberChats.map((c) => c.id));

    const pendingChats = pendingInvites
      .filter((p) => !memberChatIds.has(p.chatId))
      .map((p) => ({
        id: p.chatId,
        name: p.chatName,
        createdAt: p.chatCreatedAt,
        role: "pending" as const,
      }));

    return ok([...memberChats, ...pendingChats]);
  } catch (error) {
    return serverError("Failed to fetch chats", error);
  }
}

/**
 * POST /api/chat
 * Creates a new chat. Creator is automatically assigned admin role.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const body = await req.json().catch(() => null);
  const parsed = createChatSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0].message);

  try {
    const chat = await createChat(parsed.data.name, user.id);
    return created(chat);
  } catch (error) {
    return serverError("Failed to create chat", error);
  }
}
