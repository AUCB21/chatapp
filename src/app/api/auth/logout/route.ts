import { createSupabaseServer } from "@/lib/supabaseServer";
import { ok, serverError } from "@/lib/apiResponse";

/**
 * POST /api/auth/logout
 * Clears Supabase session cookie.
 */
export async function POST() {
  const supabase = await createSupabaseServer();

  try {
    await supabase.auth.signOut();
    return ok({ loggedOut: true });
  } catch (error) {
    return serverError("Logout failed", error);
  }
}
