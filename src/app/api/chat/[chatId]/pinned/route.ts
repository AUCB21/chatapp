import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { db } from "@/db";
import { pinnedMessages, messages, userProfiles } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getUserRole } from "@/db/queries/memberships";
import { ok, created, unauthorized, forbidden, badRequest, serverError } from "@/lib/apiResponse";
import { z } from "zod";

type Params = { params: Promise<{ chatId: string }> };

/** GET /api/chat/[chatId]/pinned — list pinned messages */
export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  const { chatId } = await params;
  try {
    const role = await getUserRole(user.id, chatId);
    if (!role) return forbidden();
    const rows = await db
      .select({
        id: pinnedMessages.id,
        messageId: pinnedMessages.messageId,
        pinnedAt: pinnedMessages.pinnedAt,
        pinnedBy: pinnedMessages.pinnedBy,
        content: messages.content,
        createdAt: messages.createdAt,
        authorId: messages.userId,
        authorName: userProfiles.displayName,
      })
      .from(pinnedMessages)
      .innerJoin(messages, eq(messages.id, pinnedMessages.messageId))
      .leftJoin(userProfiles, eq(userProfiles.userId, messages.userId))
      .where(eq(pinnedMessages.chatId, chatId))
      .orderBy(desc(pinnedMessages.pinnedAt));
    return ok(rows);
  } catch (e) {
    return serverError("Failed to fetch pinned messages", e);
  }
}

/** POST /api/chat/[chatId]/pinned — pin a message (admin only) */
export async function POST(req: NextRequest, { params }: Params) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  const { chatId } = await params;
  try {
    const role = await getUserRole(user.id, chatId);
    if (role !== "admin") return forbidden("Admin permission required");
    const body = await req.json().catch(() => null);
    const parsed = z.object({ messageId: z.string().uuid() }).safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);
    await db.insert(pinnedMessages)
      .values({ chatId, messageId: parsed.data.messageId, pinnedBy: user.id })
      .onConflictDoNothing();
    return created({ pinned: true });
  } catch (e) {
    return serverError("Failed to pin message", e);
  }
}

/** DELETE /api/chat/[chatId]/pinned — unpin a message (admin only) */
export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  const { chatId } = await params;
  try {
    const role = await getUserRole(user.id, chatId);
    if (role !== "admin") return forbidden("Admin permission required");
    const body = await req.json().catch(() => null);
    const parsed = z.object({ messageId: z.string().uuid() }).safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);
    await db.delete(pinnedMessages).where(
      and(eq(pinnedMessages.chatId, chatId), eq(pinnedMessages.messageId, parsed.data.messageId))
    );
    return ok({ unpinned: true });
  } catch (e) {
    return serverError("Failed to unpin message", e);
  }
}
