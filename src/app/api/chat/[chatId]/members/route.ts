import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { getUserRole, addMember, removeMember } from "@/db/queries/memberships";
import { addMemberSchema, updateMemberSchema } from "@/lib/validation";
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
 * POST /api/chat/[chatId]/members
 * Adds a user to the chat. Admin only.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const { chatId } = await params;

  try {
    const role = await getUserRole(user.id, chatId);
    if (role !== "admin") return forbidden("Admin permission required");

    const body = await req.json().catch(() => null);
    const parsed = addMemberSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    await addMember(parsed.data.userId, chatId, parsed.data.role);
    return created({ userId: parsed.data.userId, role: parsed.data.role });
  } catch (error) {
    return serverError("Failed to add member", error);
  }
}

/**
 * PATCH /api/chat/[chatId]/members
 * Updates a member's role. Admin only.
 * Body: { userId, role }
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const { chatId } = await params;

  try {
    const role = await getUserRole(user.id, chatId);
    if (role !== "admin") return forbidden("Admin permission required");

    const body = await req.json().catch(() => null);
    const parsed = addMemberSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    // Prevent admin from demoting themselves
    if (parsed.data.userId === user.id) return forbidden("Cannot change your own role");

    await addMember(parsed.data.userId, chatId, parsed.data.role);
    return ok({ userId: parsed.data.userId, role: parsed.data.role });
  } catch (error) {
    return serverError("Failed to update member role", error);
  }
}

/**
 * DELETE /api/chat/[chatId]/members
 * Removes a user from the chat. Admin only.
 * Body: { userId }
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const { chatId } = await params;

  try {
    const role = await getUserRole(user.id, chatId);
    if (role !== "admin") return forbidden("Admin permission required");

    const body = await req.json().catch(() => null);
    const parsed = updateMemberSchema
      .pick({})
      .extend({ userId: addMemberSchema.shape.userId })
      .safeParse(body);

    if (!parsed.success) return badRequest(parsed.error.issues[0].message);
    if (parsed.data.userId === user.id) return forbidden("Cannot remove yourself");

    await removeMember(parsed.data.userId, chatId);
    return ok({ removed: parsed.data.userId });
  } catch (error) {
    return serverError("Failed to remove member", error);
  }
}
