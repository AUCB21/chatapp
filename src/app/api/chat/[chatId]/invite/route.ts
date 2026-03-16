import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { getUserRole, addMember } from "@/db/queries/memberships";
import { db } from "@/db";
import { invitations } from "@/db/schema";
import { randomBytes } from "crypto";
import { ok, created, unauthorized, forbidden, badRequest, serverError, tooManyRequests } from "@/lib/apiResponse";
import { checkRateLimit } from "@/lib/rateLimit";
import { z } from "zod";

const inviteByEmailSchema = z.object({
  email: z.string().email(),
  role: z.enum(["read", "write", "admin"]).default("write"),
});

type Params = { params: Promise<{ chatId: string }> };

/**
 * POST /api/chat/[chatId]/invite
 * Admin-only: invite a user by email to an existing chat.
 * - If the user already has an account, adds them directly as a member.
 * - If not, creates an invitation record and sends a signup email.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const { chatId } = await params;

  try {
    const role = await getUserRole(user.id, chatId);
    if (role !== "admin") return forbidden("Admin permission required");

    const rl = checkRateLimit(`invite:${user.id}`, 10, 3_600_000);
    if (!rl.allowed) return tooManyRequests(Math.ceil((rl.resetAt - Date.now()) / 1000));

    const body = await req.json().catch(() => null);
    const parsed = inviteByEmailSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    const { email, role: memberRole } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    if (normalizedEmail === user.email?.toLowerCase()) {
      return badRequest("You are already in this chat");
    }

    const admin = createAdminClient();
    if (!admin) return serverError("Admin client not available", null);

    // Look up user by email via admin API
    const { data: usersData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existingUser = usersData?.users?.find(
      (u) => u.email?.toLowerCase() === normalizedEmail
    );

    if (existingUser) {
      // User exists — add them directly
      await addMember(existingUser.id, chatId, memberRole);
      return created({ added: true, userId: existingUser.id, invited: false });
    }

    // User doesn't exist — create invitation record and send signup email
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await db.insert(invitations).values({
      chatId,
      invitedByUserId: user.id,
      invitedEmail: normalizedEmail,
      token,
      expiresAt,
    }).onConflictDoNothing();

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
    admin.auth.admin.inviteUserByEmail(normalizedEmail, {
      redirectTo: `${siteUrl}/auth/callback`,
    }).catch((err) => console.warn("[chat-invite] email error:", err));

    return created({ added: false, invited: true });
  } catch (error) {
    return serverError("Failed to invite member", error);
  }
}
