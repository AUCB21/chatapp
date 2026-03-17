import { NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { registerSchema } from "@/lib/validation";
import { ok, badRequest, serverError } from "@/lib/apiResponse";
import { z } from "zod";

const registerWithConsentSchema = registerSchema.extend({
  consented: z.literal(true, { errorMap: () => ({ message: "You must accept the Terms of Service and Privacy Policy." }) }),
});

/**
 * POST /api/auth/register
 * Creates a new Supabase Auth user.
 * If email confirmation is disabled in Supabase, the session is active immediately.
 * If enabled, the user must verify their email before logging in.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = registerWithConsentSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0].message);

  const supabase = await createSupabaseServer();
  const consentedAt = new Date().toISOString();

  try {
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { data: { consented_at: consentedAt } },
    });

    if (error) return badRequest(error.message);

    // session is null when email confirmation is required
    const confirmed = data.session !== null;
    return ok({ 
      confirmed, 
      email: data.user?.email,
      session: data.session, // Client needs this for localStorage auth
    });
  } catch (error) {
    return serverError("Registration failed", error);
  }
}
