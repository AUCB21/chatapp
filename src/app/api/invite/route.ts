import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { createChatWithInvitation } from "@/db/queries/invitations";
import { createInviteSchema } from "@/lib/validation";
import { created, unauthorized, badRequest, serverError } from "@/lib/apiResponse";
import { createAdminClient } from "@/lib/supabaseAdmin";

/**
 * POST /api/invite
 *
 * Creates a chat and invitation(s).
 *
 * Direct: { type: "direct", invitedEmail: "user@example.com" }
 *   → creates a 1-on-1 chat (no name), one direct invitation
 *
 * Group: { type: "group", chatName: "My Group", invitedEmails?: ["a@b.com", "c@d.com"] }
 *   → creates a named group chat, one invitation per email (or a link token if no emails)
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const body = await req.json().catch(() => null);
  const parsed = createInviteSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0].message);

  const data = parsed.data;
  const userEmail = (user.email ?? "").toLowerCase();
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin).replace(/\/$/, "");

  try {
    if (data.type === "direct") {
      if (data.invitedEmail.toLowerCase() === userEmail) {
        return badRequest("You cannot invite yourself");
      }

      const { chat } = await createChatWithInvitation(
        user.id,
        "direct",
        [data.invitedEmail]
      );

      sendInviteEmailIfNeeded(data.invitedEmail, siteUrl).catch(
        (err) => console.warn("[invite] email send failed:", err)
      );

      return created({
        chatId: chat.id,
        chatName: null,
        inviteToken: null,
        delivery: "direct",
        invitedEmails: [data.invitedEmail],
      });
    }

    // Group chat
    const invitedEmails = (data.invitedEmails ?? []).filter(
      (e) => e.toLowerCase() !== userEmail
    );

    const { chat, inviteToken } = await createChatWithInvitation(
      user.id,
      "group",
      invitedEmails,
      data.chatName
    );

    for (const email of invitedEmails) {
      sendInviteEmailIfNeeded(email, siteUrl).catch(
        (err) => console.warn("[invite] email send failed:", err)
      );
    }

    return created({
      chatId: chat.id,
      chatName: chat.name,
      inviteToken: inviteToken ?? null,
      delivery: invitedEmails.length === 0 ? "link" : "direct",
      invitedEmails,
    });
  } catch (error) {
    return serverError("Failed to create invitation", error);
  }
}

/**
 * Sends a Supabase invite email if the target email has no existing account.
 * Runs fire-and-forget — never blocks the invitation response.
 */
async function sendInviteEmailIfNeeded(email: string, origin: string) {
  const admin = createAdminClient();
  if (!admin) return;

  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/reset-password`,
  });

  if (error) {
    if (error.message?.includes("already")) return; // user exists — expected
    console.warn("[invite] invite email error:", error.message);
  } else {
    console.log(`[invite] signup email sent to ${email}`);
  }
}
