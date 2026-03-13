import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { createChatWithInvitation } from "@/db/queries/invitations";
import { createInviteSchema } from "@/lib/validation";
import { created, unauthorized, badRequest, serverError } from "@/lib/apiResponse";

/**
 * POST /api/invite
 * Creates a new chat and either:
 * - records a direct invitation for a specific email, or
 * - records a shareable token invitation when no email is provided.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const body = await req.json().catch(() => null);
  const parsed = createInviteSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0].message);

  const { chatName, invitedEmail } = parsed.data;

  if (invitedEmail && invitedEmail.toLowerCase() === (user.email ?? "").toLowerCase()) {
    return badRequest("You cannot invite yourself");
  }

  try {
    const normalizedEmail = invitedEmail?.trim() || undefined;
    const { chat, invitation } = await createChatWithInvitation(
      chatName,
      user.id,
      normalizedEmail
    );

    return created({
      chatId: chat.id,
      chatName: chat.name,
      inviteToken: normalizedEmail ? null : invitation.token,
      delivery: normalizedEmail ? "direct" : "link",
      invitedEmail: normalizedEmail ?? null,
    });
  } catch (error) {
    return serverError("Failed to create invitation", error);
  }
}
