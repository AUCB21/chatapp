import { eq, inArray } from "drizzle-orm";
import { db } from "../index";
import { attachments, messages } from "../schema";

/**
 * Insert one or more attachment rows for a message.
 */
export async function createAttachments(
  rows: {
    messageId: string;
    storagePath: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  }[]
) {
  if (rows.length === 0) return [];
  return db.insert(attachments).values(rows).returning();
}

/**
 * Fetch attachments for a list of message IDs.
 * Returns a map of messageId → Attachment[].
 */
export async function getAttachmentsForMessages(messageIds: string[]) {
  if (messageIds.length === 0) return {};

  const rows = await db
    .select()
    .from(attachments)
    .where(inArray(attachments.messageId, messageIds));

  const map: Record<string, typeof rows> = {};
  for (const row of rows) {
    if (!map[row.messageId]) map[row.messageId] = [];
    map[row.messageId].push(row);
  }
  return map;
}

/**
 * Fetch attachments for a single message.
 */
export async function getAttachmentsForMessage(messageId: string) {
  return db
    .select()
    .from(attachments)
    .where(eq(attachments.messageId, messageId));
}

/**
 * Get a single attachment by ID.
 */
export async function getAttachment(attachmentId: string) {
  const [row] = await db
    .select()
    .from(attachments)
    .where(eq(attachments.id, attachmentId))
    .limit(1);
  return row ?? null;
}

/**
 * Fetch all storage paths for attachments belonging to messages sent by a user.
 * Used during account deletion to clean up Supabase Storage.
 */
export async function getAttachmentsByUserId(userId: string) {
  return db
    .select({ storagePath: attachments.storagePath })
    .from(attachments)
    .innerJoin(messages, eq(messages.id, attachments.messageId))
    .where(eq(messages.userId, userId));
}

/**
 * Delete attachment rows for a message (storage cleanup is done separately).
 */
export async function deleteAttachmentsForMessage(messageId: string) {
  return db
    .delete(attachments)
    .where(eq(attachments.messageId, messageId))
    .returning();
}
