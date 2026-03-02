import { NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { z } from "zod";
import { ok, unauthorized, badRequest, serverError } from "@/lib/apiResponse";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

/**
 * POST /api/auth/login
 * Delegates to Supabase Auth. Session cookie is set by Supabase SSR client.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0].message);

  const supabase = await createSupabaseServer();

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (error) return unauthorized(error.message);

    // Return both user info AND session for client-side Supabase sync
    return ok({ 
      id: data.user.id, 
      email: data.user.email,
      session: data.session, // Client needs this to sync auth
    });
  } catch (error) {
    return serverError("Login failed", error);
  }
}
