import { NextRequest } from "next/server";
import { getAuthUser, createSupabaseServer } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { db } from "@/db/index";
import {
  messages,
  memberships,
  readReceipts,
  reactions,
  invitations,
  deletedForMe,
  userProfiles,
} from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { unauthorized, ok, serverError } from "@/lib/apiResponse";
import { getAttachmentsByUserId } from "@/db/queries/attachments";

const BUCKET = "chat-attachments";

/**
 * DELETE /api/auth/account
 * Permanently removes all user data with cascading cleanup.
 *
 * Steps:
 * 1. Bulk-insert deleted_for_me rows for all messages the user sent
 *    (vanishes from user's view without affecting other recipients)
 * 2. Anonymize messages (replace content with "[Deleted account]", soft-delete)
 * 3. Delete reactions, read receipts, deleted_for_me, memberships, invitations, profile
 * 4. Delete Supabase auth user
 *
 * Chats are NOT deleted — other members may still use them.
 */
export async function DELETE(_req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const userId = user.id;

  try {
    // 0. Delete uploaded files from storage before anonymizing messages
    const adminClient = createAdminClient();
    if (adminClient) {
      const userAttachments = await getAttachmentsByUserId(userId);
      if (userAttachments.length > 0) {
        const paths = userAttachments.map((a) => a.storagePath);
        for (let i = 0; i < paths.length; i += 100) {
          await adminClient.storage.from(BUCKET).remove(paths.slice(i, i + 100));
        }
      }
    }

    // 1. Bulk-insert deleted_for_me for all messages this user sent
    await db.execute(sql`
      INSERT INTO deleted_for_me (user_id, message_id)
      SELECT ${userId}, id FROM messages WHERE user_id = ${userId}
      ON CONFLICT DO NOTHING
    `);

    // 2. Anonymize messages (soft-delete + replace content)
    await db
      .update(messages)
      .set({
        content: "[Deleted account]",
        deletedAt: new Date(),
        userId: sql`'00000000-0000-0000-0000-000000000000'::uuid`,
      })
      .where(eq(messages.userId, userId));

    // 3. Delete associated data (parallel where no FK dependency)
    await Promise.all([
      db.delete(reactions).where(eq(reactions.userId, userId)),
      db.delete(readReceipts).where(eq(readReceipts.userId, userId)),
      db.delete(deletedForMe).where(eq(deletedForMe.userId, userId)),
    ]);

    await db.delete(memberships).where(eq(memberships.userId, userId));
    await db.delete(invitations).where(eq(invitations.invitedByUserId, userId));
    await db.delete(userProfiles).where(eq(userProfiles.userId, userId));

    // 4. Delete Supabase auth user
    if (adminClient) {
      await adminClient.auth.admin.deleteUser(userId);
    } else {
      const supabase = await createSupabaseServer();
      await supabase.auth.signOut();
    }

    return ok({
      message: "Account and all associated data have been permanently deleted.",
    });
  } catch (error) {
    return serverError("Failed to delete account", error);
  }
}
