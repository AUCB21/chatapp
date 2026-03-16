import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { db } from "@/db";
import { starredMessages, messages, attachments } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { ok, created, unauthorized, badRequest, serverError } from "@/lib/apiResponse";
import { z } from "zod";

/** GET /api/starred — list starred messages with content */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  try {
    const rows = await db
      .select({
        messageId: starredMessages.messageId,
        starredAt: starredMessages.createdAt,
        content: messages.content,
        chatId: messages.chatId,
        userId: messages.userId,
        createdAt: messages.createdAt,
        deletedAt: messages.deletedAt,
      })
      .from(starredMessages)
      .innerJoin(messages, eq(messages.id, starredMessages.messageId))
      .where(eq(starredMessages.userId, user.id))
      .orderBy(desc(starredMessages.createdAt));
    return ok(rows);
  } catch (e) {
    return serverError("Failed to fetch starred messages", e);
  }
}

/** POST /api/starred — star a message */
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  const body = await req.json().catch(() => null);
  const parsed = z.object({ messageId: z.string().uuid() }).safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0].message);
  try {
    await db.insert(starredMessages)
      .values({ userId: user.id, messageId: parsed.data.messageId })
      .onConflictDoNothing();
    return created({ starred: true });
  } catch (e) {
    return serverError("Failed to star message", e);
  }
}

/** DELETE /api/starred — unstar a message */
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  const body = await req.json().catch(() => null);
  const parsed = z.object({ messageId: z.string().uuid() }).safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0].message);
  try {
    await db.delete(starredMessages).where(
      and(eq(starredMessages.userId, user.id), eq(starredMessages.messageId, parsed.data.messageId))
    );
    return ok({ unstarred: true });
  } catch (e) {
    return serverError("Failed to unstar message", e);
  }
}
