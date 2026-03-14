import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import {
  getAccessibleChats,
  createChat,
  getDirectChatPartnerNames,
} from "@/db/queries/chats";
import { getPendingInvitationsForEmail } from "@/db/queries/invitations";
import { createChatSchema } from "@/lib/validation";
import { ok, created, unauthorized, badRequest, serverError } from "@/lib/apiResponse";

/**
 * GET /api/chat
 * Returns all chats the user is a member of, plus pending invitations.
 * Each chat includes a computed `displayName`:
 *  - direct: other member's display name (or invited email while pending)
 *  - group: chat name
 */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  try {
    const [memberChats, pendingInvites] = await Promise.all([
      getAccessibleChats(user.id),
      getPendingInvitationsForEmail(user.email ?? ""),
    ]);

    // Unread counts from membership column
    const unreadCounts: Record<string, number> = {};
    for (const c of memberChats) {
      if (c.unreadCount > 0) unreadCounts[c.id] = c.unreadCount;
    }

    // Compute display names for direct chats
    const directChatIds = memberChats
      .filter((c) => c.type === "direct")
      .map((c) => c.id);
    const directNames =
      directChatIds.length > 0
        ? await getDirectChatPartnerNames(directChatIds, user.id)
        : {};

    const chatsWithNames = memberChats.map((c) => ({
      ...c,
      displayName:
        c.type === "direct"
          ? (directNames[c.id] ?? "Direct Message")
          : (c.name ?? "Group Chat"),
    }));

    const memberChatIds = new Set(memberChats.map((c) => c.id));

    const pendingChats = pendingInvites
      .filter((p) => !memberChatIds.has(p.chatId))
      .map((p) => ({
        id: p.chatId,
        name: p.chatName,
        type: p.chatType,
        displayName:
          p.chatType === "direct"
            ? (p.inviterDisplayName ?? "Direct Message")
            : (p.chatName ?? "Group Chat"),
        createdAt: p.chatCreatedAt,
        role: "pending" as const,
        unreadCount: 0,
      }));

    return ok({ chats: [...chatsWithNames, ...pendingChats], unreadCounts });
  } catch (error) {
    return serverError("Failed to fetch chats", error);
  }
}

/**
 * POST /api/chat
 * Creates a new group chat. Creator is automatically assigned admin role.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const body = await req.json().catch(() => null);
  const parsed = createChatSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0].message);

  try {
    const chat = await createChat(parsed.data.name, user.id);
    return created({ ...chat, displayName: chat.name ?? "Group Chat" });
  } catch (error) {
    return serverError("Failed to create chat", error);
  }
}
