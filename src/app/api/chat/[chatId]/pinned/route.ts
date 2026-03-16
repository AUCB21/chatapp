import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { db } from "@/db";
import { messages } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getUserRole } from "@/db/queries/memberships";
import { ok, created, unauthorized, forbidden, badRequest, serverError } from "@/lib/apiResponse";
import { z } from "zod";

type Params = { params: Promise<{ chatId: string }> };

const bodySchema = z.object({ messageId: z.string().uuid() });

/** POST /api/chat/[chatId]/pinned — pin a message (admin only) */
export async function POST(req: NextRequest, { params }: Params) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  const { chatId } = await params;
  try {
    const role = await getUserRole(user.id, chatId);
    if (role !== "admin") return forbidden("Admin permission required");
    const body = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    // Unpin any currently pinned message, then pin the new one — single transaction
    await db.transaction(async (tx) => {
      await tx.update(messages)
        .set({ isPinned: false })
        .where(and(eq(messages.chatId, chatId), eq(messages.isPinned, true)));
      await tx.update(messages)
        .set({ isPinned: true })
        .where(and(eq(messages.id, parsed.data.messageId), eq(messages.chatId, chatId)));
    });

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
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    await db.update(messages)
      .set({ isPinned: false })
      .where(and(eq(messages.id, parsed.data.messageId), eq(messages.chatId, chatId)));

    return ok({ unpinned: true });
  } catch (e) {
    return serverError("Failed to unpin message", e);
  }
}
