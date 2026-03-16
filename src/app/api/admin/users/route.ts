import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { isGlobalAdmin, adminListUsers } from "@/db/queries/admin";
import { ok, unauthorized, forbidden, badRequest, serverError } from "@/lib/apiResponse";
import { z } from "zod";

const deleteSchema = z.object({ userId: z.string().uuid() });

/**
 * GET /api/admin/users
 * Returns paginated list of user profiles.
 */
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  if (!(await isGlobalAdmin(user.id))) return forbidden();

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
  const offset = Number(url.searchParams.get("offset") ?? 0);

  try {
    const users = await adminListUsers(limit, offset);
    return ok({ users });
  } catch (error) {
    return serverError("Failed to list users", error);
  }
}

/**
 * DELETE /api/admin/users
 * Deletes a user from Supabase Auth (and cascades to profile via DB trigger).
 * Body: { userId: string }
 */
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  if (!(await isGlobalAdmin(user.id))) return forbidden();

  const body = await req.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0].message);

  if (parsed.data.userId === user.id) {
    return badRequest("Cannot delete your own account");
  }

  const admin = createAdminClient();
  if (!admin) return serverError("Admin client not available");

  try {
    const { error } = await admin.auth.admin.deleteUser(parsed.data.userId);
    if (error) return serverError("Failed to delete user", error);
    return ok({ deleted: true, userId: parsed.data.userId });
  } catch (error) {
    return serverError("Failed to delete user", error);
  }
}
