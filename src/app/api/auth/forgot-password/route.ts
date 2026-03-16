import { NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { z } from "zod";
import { ok, badRequest, serverError, tooManyRequests } from "@/lib/apiResponse";
import { checkRateLimit } from "@/lib/rateLimit";

const schema = z.object({
  email: z.string().email(),
});

/**
 * POST /api/auth/forgot-password
 * Sends a password reset email via Supabase Auth.
 * Always returns 200 to avoid leaking whether the email exists.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0].message);

  const rl = checkRateLimit(`forgot-pw:${parsed.data.email.toLowerCase()}`, 3, 3_600_000);
  if (!rl.allowed) return tooManyRequests(Math.ceil((rl.resetAt - Date.now()) / 1000));

  const supabase = await createSupabaseServer();

  try {
    const siteUrl = (
      process.env.NEXT_PUBLIC_SITE_URL ||
      req.nextUrl.origin
    ).replace(/\/$/, "");

    await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${siteUrl}/reset-password`,
    });

    // Always return success to prevent email enumeration
    return ok({ message: "If an account exists, a reset link has been sent." });
  } catch (error) {
    return serverError("Failed to send reset email", error);
  }
}
