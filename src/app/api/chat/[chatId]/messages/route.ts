import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { getUserRole } from "@/db/queries/memberships";
import { getMessages, createMessage } from "@/db/queries/messages";
import { sendMessageSchema } from "@/lib/validation";
import {
  ok,
  created,
  unauthorized,
  forbidden,
  badRequest,
  serverError,
} from "@/lib/apiResponse";

type Params = { params: Promise<{ chatId: string }> };

/**
 * GET /api/chat/[chatId]/messages
 * Returns all messages for the chat.
 * Requires any role (read | write | admin).
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const { chatId } = await params;

  try {
    const role = await getUserRole(user.id, chatId);
    if (!role) return forbidden();

    const messages = await getMessages(user.id, chatId);
    return ok(messages);
  } catch {
    return serverError();
  }
}

/**
 * POST /api/chat/[chatId]/messages
 * Sends a message. Requires write or admin role.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const { chatId } = await params;

  try {
    const role = await getUserRole(user.id, chatId);
    if (!role) return forbidden();
    if (role === "read") return forbidden("Write permission required");

    const body = await req.json().catch(() => null);
    const parsed = sendMessageSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    const message = await createMessage(user.id, chatId, parsed.data.content);
    return created(message);
  } catch {
    return serverError();
  }
}
