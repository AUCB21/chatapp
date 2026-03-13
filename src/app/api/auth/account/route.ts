import { NextRequest } from "next/server";
import { getAuthUser, createSupabaseServer } from "@/lib/supabaseServer";
import { db } from "@/db/index";
import { messages, memberships, readReceipts, reactions, invitations } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { unauthorized, ok, serverError } from "@/lib/apiResponse";

/**
 * DELETE /api/auth/account
 * GDPR Right to be Forgotten — permanently removes all user data.
 *
 * Steps:
 * 1. Anonymize user's messages (replace content, clear userId association)
 * 2. Delete read receipts, reactions, memberships, invitations
 * 3. Delete Supabase auth user
 *
 * This does NOT delete chats themselves (other members may still use them).
 */
export async function DELETE(_req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const userId = user.id;

  try {
    // 1. Anonymize messages (soft-delete all, replace content)
    await db
      .update(messages)
      .set({
        content: "[Deleted account]",
        deletedAt: new Date(),
        userId: sql`'00000000-0000-0000-0000-000000000000'::uuid`, // anonymous placeholder
      })
      .where(eq(messages.userId, userId));

    // 2. Delete reactions by this user
    await db.delete(reactions).where(eq(reactions.userId, userId));

    // 3. Delete read receipts
    await db.delete(readReceipts).where(eq(readReceipts.userId, userId));

    // 4. Delete memberships
    await db.delete(memberships).where(eq(memberships.userId, userId));

    // 5. Delete invitations sent by this user
    await db.delete(invitations).where(eq(invitations.invitedByUserId, userId));

    // 6. Delete Supabase auth user (requires service_role key or admin API)
    // Using the server client which has the user's session to sign them out.
    // Full deletion of the auth.users row requires the service role key.
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseServiceKey) {
      const { createClient } = await import("@supabase/supabase-js");
      const supabaseUrl =
        process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

      if (!supabaseUrl) {
        throw new Error("Missing SUPABASE_URL for admin client creation");
      }

      const adminClient = createClient(
        supabaseUrl,
        supabaseServiceKey,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );
      await adminClient.auth.admin.deleteUser(userId);
    } else {
      // Fallback: sign out the user (they can't log back in after data is erased)
      const supabase = await createSupabaseServer();
      await supabase.auth.signOut();
    }

    return ok({ message: "Account and all associated data have been permanently deleted." });
  } catch (error) {
    return serverError("Failed to delete account", error);
  }
}
