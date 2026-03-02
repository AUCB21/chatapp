import { NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ok, unauthorized } from "@/lib/apiResponse";

/**
 * GET /api/auth/session
 * Returns the current session from server-side cookies.
 * Used to sync auth to client-side Supabase for Realtime.
 */
export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error || !session) {
    return unauthorized("No active session");
  }
  
  return ok({ session });
}
