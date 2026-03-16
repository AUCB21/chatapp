import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { db } from "@/db";
import { blockedUsers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { ok, unauthorized, badRequest, serverError } from "@/lib/apiResponse";
import { z } from "zod";

const schema = z.object({ userId: z.string().uuid() });

/** GET /api/block — list blocked user IDs */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  try {
    const rows = await db
      .select({ blockedId: blockedUsers.blockedId })
      .from(blockedUsers)
      .where(eq(blockedUsers.blockerId, user.id));
    return ok(rows.map((r) => r.blockedId));
  } catch (e) {
    return serverError("Failed to fetch block list", e);
  }
}

/** POST /api/block — block a user */
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0].message);
  const { userId } = parsed.data;
  if (userId === user.id) return badRequest("Cannot block yourself");
  try {
    await db.insert(blockedUsers).values({ blockerId: user.id, blockedId: userId }).onConflictDoNothing();
    return ok({ blocked: true });
  } catch (e) {
    return serverError("Failed to block user", e);
  }
}

/** DELETE /api/block — unblock a user */
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0].message);
  const { userId } = parsed.data;
  try {
    await db.delete(blockedUsers).where(
      and(eq(blockedUsers.blockerId, user.id), eq(blockedUsers.blockedId, userId))
    );
    return ok({ unblocked: true });
  } catch (e) {
    return serverError("Failed to unblock user", e);
  }
}
