import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { createChatWithInvitation } from "@/db/queries/invitations";
import { createInviteSchema } from "@/lib/validation";
import { created, unauthorized, badRequest, serverError } from "@/lib/apiResponse";

/**
 * POST /api/invite
 * Creates a new chat and records an in-app invitation for the given email.
 * The creator becomes admin immediately. The invitee sees the chat in their
 * sidebar (role "pending") and can accept or decline from there.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const body = await req.json().catch(() => null);
  const parsed = createInviteSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0].message);

  const { chatName, invitedEmail } = parsed.data;

  try {
    const { chat } = await createChatWithInvitation(chatName, user.id, invitedEmail);
    return created({ chatId: chat.id, chatName: chat.name });
  } catch {
    return serverError();
  }
}
