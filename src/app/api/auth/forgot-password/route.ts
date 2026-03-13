import { NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { z } from "zod";
import { ok, badRequest, serverError } from "@/lib/apiResponse";

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

  const supabase = await createSupabaseServer();

  try {
    await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${req.nextUrl.origin}/reset-password`,
    });

    // Always return success to prevent email enumeration
    return ok({ message: "If an account exists, a reset link has been sent." });
  } catch (error) {
    return serverError("Failed to send reset email", error);
  }
}
