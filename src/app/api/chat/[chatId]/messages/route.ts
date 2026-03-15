import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { getAuthUser } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { getUserRole } from "@/db/queries/memberships";
import {
  getMessages,
  searchMessages,
  createMessage,
  editMessage,
  deleteMessage,
  hideMessageForUser,
  markRead,
  getReactionsForChat,
} from "@/db/queries/messages";
import {
  createAttachments,
  getAttachmentsForMessages,
  getAttachmentsForMessage,
  deleteAttachmentsForMessage,
} from "@/db/queries/attachments";
import {
  sendMessageSchema,
  editMessageSchema,
  deleteMessageSchema,
  MAX_FILE_SIZE,
  MAX_FILES_PER_MESSAGE,
  ALLOWED_MIME_TYPES,
  CODE_FILE_EXTENSIONS,
} from "@/lib/validation";
import {
  ok,
  created,
  unauthorized,
  forbidden,
  badRequest,
  notFound,
  serverError,
} from "@/lib/apiResponse";

type Params = { params: Promise<{ chatId: string }> };

const PAGE_SIZE = 25;
const SIGNED_URL_TTL = 300; // 5 minutes
const BUCKET = "chat-attachments";

/**
 * Generate signed URLs for a batch of attachments.
 * Mutates each attachment object to add a `signedUrl` field.
 */
async function enrichWithSignedUrls(
  attachmentMap: Record<string, { storagePath: string; [k: string]: unknown }[]>
) {
  const admin = createAdminClient();
  if (!admin) return attachmentMap;

  const allAttachments = Object.values(attachmentMap).flat();
  if (allAttachments.length === 0) return attachmentMap;

  const paths = allAttachments.map((a) => a.storagePath);
  const { data } = await admin.storage
    .from(BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL);

  if (data) {
    for (let i = 0; i < allAttachments.length; i++) {
      (allAttachments[i] as Record<string, unknown>).signedUrl =
        data[i]?.signedUrl ?? null;
    }
  }

  return attachmentMap;
}

/**
 * GET /api/chat/[chatId]/messages
 * Returns messages for the chat (with reactions and attachments).
 * Supports ?before=<ISO8601> for pagination and ?search=<query> for search.
 * Also marks messages as read for the requesting user.
 */
export async function GET(req: NextRequest, { params }: Params) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const { chatId } = await params;

  try {
    const role = await getUserRole(user.id, chatId);
    if (!role) return forbidden();

    const url = new URL(req.url);
    const searchQuery = url.searchParams.get("search");

    // Search mode — return matching messages, no reactions needed
    if (searchQuery) {
      const results = await searchMessages(user.id, chatId, searchQuery);
      return ok({ messages: results, reactions: [], attachments: {} });
    }

    const beforeParam = url.searchParams.get("before");
    const before = beforeParam ? new Date(beforeParam) : undefined;

    const [msgs, reactions] = await Promise.all([
      getMessages(user.id, chatId, { before, limit: PAGE_SIZE }),
      before ? Promise.resolve([]) : getReactionsForChat(chatId),
    ]);

    const hasMore = msgs.length === PAGE_SIZE;

    // Fetch attachments for this page of messages
    const messageIds = msgs.map((m) => m.id);
    const attachmentMap = await getAttachmentsForMessages(messageIds);
    await enrichWithSignedUrls(attachmentMap);

    // Mark messages as read in background (don't block response)
    if (!before) {
      markRead(chatId, user.id).catch((e) =>
        console.error("[markRead]", e)
      );
    }

    return ok({ messages: msgs, reactions, hasMore, attachments: attachmentMap });
  } catch (error) {
    return serverError("Failed to fetch messages", error);
  }
}

/**
 * POST /api/chat/[chatId]/messages
 * Sends a message with optional file attachments.
 * Accepts JSON (text-only) or multipart/form-data (with files).
 */
export async function POST(req: NextRequest, { params }: Params) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const { chatId } = await params;

  try {
    const role = await getUserRole(user.id, chatId);
    if (!role) return forbidden();
    if (role === "read") return forbidden("Write permission required");

    const contentType = req.headers.get("content-type") ?? "";
    const isMultipart = contentType.includes("multipart/form-data");

    let content = "";
    let parentId: string | undefined;
    let files: File[] = [];

    if (isMultipart) {
      const formData = await req.formData();
      content = (formData.get("content") as string) ?? "";
      const rawParentId = formData.get("parentId") as string | null;
      if (rawParentId) parentId = rawParentId;
      files = formData.getAll("files") as File[];
    } else {
      const body = await req.json().catch(() => null);
      const parsed = sendMessageSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.issues[0].message);
      content = parsed.data.content;
      parentId = parsed.data.parentId;
    }

    // Validate: at least content or files
    const trimmedContent = content.trim();
    if (!trimmedContent && files.length === 0) {
      return badRequest("Message must have content or at least one file");
    }
    if (trimmedContent.length > 4000) {
      return badRequest("Message content must be 4000 characters or less");
    }
    if (files.length > MAX_FILES_PER_MESSAGE) {
      return badRequest(`Maximum ${MAX_FILES_PER_MESSAGE} files per message`);
    }

    // Validate files
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return badRequest(`File "${file.name}" exceeds 10 MB limit`);
      }
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!ALLOWED_MIME_TYPES.has(file.type) && !CODE_FILE_EXTENSIONS.has(ext)) {
        return badRequest(`File type "${file.type}" is not allowed`);
      }
    }

    // Create message (allow empty content for attachment-only)
    const message = await createMessage(
      user.id,
      chatId,
      trimmedContent || "",
      parentId
    );

    // Upload files and create attachment records
    let savedAttachments: Awaited<ReturnType<typeof createAttachments>> = [];

    if (files.length > 0) {
      const admin = createAdminClient();
      if (!admin) return serverError("Storage not configured");

      const attachmentRows: Parameters<typeof createAttachments>[0] = [];

      for (const file of files) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const storagePath = `${chatId}/${randomUUID()}-${safeName}`;

        const { error: uploadError } = await admin.storage
          .from(BUCKET)
          .upload(storagePath, buffer, {
            contentType: file.type,
            upsert: false,
          });

        if (uploadError) {
          console.error("[Upload]", uploadError);
          return serverError(`Failed to upload "${file.name}"`);
        }

        attachmentRows.push({
          messageId: message.id,
          storagePath,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        });
      }

      savedAttachments = await createAttachments(attachmentRows);

      // Generate signed URLs for the response
      if (admin && savedAttachments.length > 0) {
        const paths = savedAttachments.map((a) => a.storagePath);
        const { data: signedData } = await admin.storage
          .from(BUCKET)
          .createSignedUrls(paths, SIGNED_URL_TTL);

        if (signedData) {
          savedAttachments = savedAttachments.map((a, i) => ({
            ...a,
            signedUrl: signedData[i]?.signedUrl ?? null,
          }));
        }
      }
    }

    return created({ ...message, attachments: savedAttachments });
  } catch (error) {
    return serverError("Failed to send message", error);
  }
}

/**
 * PUT /api/chat/[chatId]/messages
 * Marks all messages in the chat as read for the requesting user.
 */
export async function PUT(_req: NextRequest, { params }: Params) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const { chatId } = await params;

  try {
    const role = await getUserRole(user.id, chatId);
    if (!role) return forbidden();

    await markRead(chatId, user.id);
    return ok({ marked: true });
  } catch (error) {
    return serverError("Failed to mark as read", error);
  }
}

/**
 * PATCH /api/chat/[chatId]/messages
 * Edits a message. Only the author can edit.
 * Body: { messageId: string, content: string }
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const { chatId } = await params;

  try {
    const role = await getUserRole(user.id, chatId);
    if (!role) return forbidden();

    const body = await req.json().catch(() => null);
    if (!body?.messageId) return badRequest("messageId is required");

    const parsed = editMessageSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    const updated = await editMessage(user.id, body.messageId, parsed.data.content);
    if (!updated) return notFound("Message not found or not yours");

    return ok(updated);
  } catch (error) {
    return serverError("Failed to edit message", error);
  }
}

/**
 * DELETE /api/chat/[chatId]/messages
 * Deletes a message for the requester or for everyone.
 * Body: { messageId: string, mode?: "for_me" | "for_everyone" }
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const { chatId } = await params;

  try {
    const role = await getUserRole(user.id, chatId);
    if (!role) return forbidden();

    const body = await req.json().catch(() => null);
    const parsed = deleteMessageSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    const mode = parsed.data.mode ?? "for_everyone";

    if (mode === "for_me") {
      const hidden = await hideMessageForUser(user.id, chatId, parsed.data.messageId);
      if (!hidden) return notFound("Message not found in this chat");

      return ok({ messageId: parsed.data.messageId, mode });
    }

    // Clean up storage objects before soft-deleting
    const attachmentRows = await getAttachmentsForMessage(parsed.data.messageId);
    if (attachmentRows.length > 0) {
      const admin = createAdminClient();
      if (admin) {
        const paths = attachmentRows.map((a) => a.storagePath);
        await admin.storage.from(BUCKET).remove(paths);
      }
      await deleteAttachmentsForMessage(parsed.data.messageId);
    }

    const deleted = await deleteMessage(user.id, parsed.data.messageId);
    if (!deleted) return notFound("Message not found or not yours");

    return ok(deleted);
  } catch (error) {
    return serverError("Failed to delete message", error);
  }
}
