import { getAuthUser } from "@/lib/supabaseServer";
import { isGlobalAdmin, adminGetStats } from "@/db/queries/admin";
import { ok, unauthorized, forbidden, serverError } from "@/lib/apiResponse";

/**
 * GET /api/admin/stats
 * Returns aggregate usage stats (total users, chats, messages).
 */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  if (!(await isGlobalAdmin(user.id))) return forbidden();

  try {
    const stats = await adminGetStats();
    return ok(stats);
  } catch (error) {
    return serverError("Failed to fetch stats", error);
  }
}
