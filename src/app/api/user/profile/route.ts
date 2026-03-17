import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { getOrCreateProfile, updateProfile } from "@/db/queries/profiles";
import { updateProfileSchema } from "@/lib/validation";
import { ok, unauthorized, badRequest, serverError } from "@/lib/apiResponse";

/**
 * GET /api/user/profile
 * Returns the current user's profile (creates default if missing).
 */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  try {
    const consentedAt = user.user_metadata?.consented_at
      ? new Date(user.user_metadata.consented_at as string)
      : undefined;
    const profile = await getOrCreateProfile(user.id, user.email ?? "", consentedAt);
    return ok({ profile });
  } catch (error) {
    return serverError("Failed to fetch profile", error);
  }
}

/**
 * PATCH /api/user/profile
 * Updates the current user's profile fields.
 */
export async function PATCH(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  try {
    const body = await req.json().catch(() => null);
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    const profile = await updateProfile(user.id, parsed.data);
    return ok({ profile });
  } catch (error) {
    return serverError("Failed to update profile", error);
  }
}
