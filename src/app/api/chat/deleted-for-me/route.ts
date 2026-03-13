import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { syncDeletedMessagesForUser } from "@/db/queries/messages";
import { syncDeletedMessagesSchema } from "@/lib/validation";
import {
  ok,
  unauthorized,
  badRequest,
  serverError,
} from "@/lib/apiResponse";

/**
 * POST /api/chat/deleted-for-me
 * Silently migrates locally hidden message IDs into server-side persistence.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  try {
    const body = await req.json().catch(() => null);
    const parsed = syncDeletedMessagesSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    const messageIds = await syncDeletedMessagesForUser(user.id, parsed.data.messageIds);
    return ok({ messageIds, synced: messageIds.length });
  } catch (error) {
    return serverError("Failed to sync deleted messages", error);
  }
}