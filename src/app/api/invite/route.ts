import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { createChatWithInvitation } from "@/db/queries/invitations";
import { createInviteSchema } from "@/lib/validation";
import { created, unauthorized, badRequest, serverError } from "@/lib/apiResponse";
import { createAdminClient } from "@/lib/supabaseAdmin";

/**
 * POST /api/invite
 * Creates a new chat and either:
 * - records a direct invitation for a specific email, or
 * - records a shareable token invitation when no email is provided.
 *
 * When a direct email invitation targets a user who has no account yet,
 * Supabase `inviteUserByEmail` sends them a signup magic-link email.
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

    // For direct email invitations, send a signup email if the user doesn't exist yet
    if (normalizedEmail) {
      sendInviteEmailIfNeeded(normalizedEmail, req.nextUrl.origin).catch(
        (err) => console.warn("[invite] email send failed (non-blocking):", err)
      );
    }

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

/**
 * Sends a Supabase invite email if the target email has no existing account.
 * Uses the admin API — requires SUPABASE_SERVICE_ROLE_KEY.
 * Runs fire-and-forget so it never blocks the invitation response.
 *
 * Strategy: just call inviteUserByEmail — if the user already exists,
 * Supabase returns an error which we silently ignore.
 */
async function sendInviteEmailIfNeeded(email: string, origin: string) {
  const admin = createAdminClient();
  if (!admin) return; // no service role key configured

  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/login`,
  });

  if (error) {
    // "User already registered" → expected, ignore silently
    if (error.message?.includes("already")) return;
    console.warn("[invite] invite email error:", error.message);
  } else {
    console.log(`[invite] signup email sent to ${email}`);
  }
}
