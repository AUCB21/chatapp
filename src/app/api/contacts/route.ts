import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { db } from "@/db";
import { contacts, userProfiles } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { ok, created, unauthorized, badRequest, serverError, notFound } from "@/lib/apiResponse";
import { z } from "zod";

const addSchema = z.object({
  contactId: z.string().uuid(),
  nickname: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
});

const updateSchema = z.object({
  contactId: z.string().uuid(),
  nickname: z.string().max(100).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

/** GET /api/contacts — list contacts with profile info */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  try {
    const rows = await db
      .select({
        contactId: contacts.contactId,
        nickname: contacts.nickname,
        notes: contacts.notes,
        createdAt: contacts.createdAt,
        displayName: userProfiles.displayName,
        username: userProfiles.username,
        avatarUrl: userProfiles.avatarUrl,
        status: userProfiles.status,
      })
      .from(contacts)
      .leftJoin(userProfiles, eq(userProfiles.userId, contacts.contactId))
      .where(eq(contacts.ownerId, user.id))
      .orderBy(contacts.createdAt);
    return ok(rows);
  } catch (e) {
    return serverError("Failed to fetch contacts", e);
  }
}

/** POST /api/contacts — add a contact by userId or email */
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  const body = await req.json().catch(() => null);

  // Support adding by email
  if (body?.email && !body?.contactId) {
    const admin = createAdminClient();
    if (!admin) return serverError("Admin client unavailable", null);
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const found = data?.users?.find((u) => u.email?.toLowerCase() === body.email.toLowerCase().trim());
    if (!found) return notFound("No user with that email");
    body.contactId = found.id;
  }

  const parsed = addSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0].message);
  const { contactId, nickname, notes } = parsed.data;
  if (contactId === user.id) return badRequest("Cannot add yourself as contact");

  try {
    await db.insert(contacts).values({
      ownerId: user.id,
      contactId,
      nickname: nickname ?? null,
      notes: notes ?? null,
    }).onConflictDoNothing();
    return created({ added: true, contactId });
  } catch (e) {
    return serverError("Failed to add contact", e);
  }
}

/** PATCH /api/contacts — update nickname/notes */
export async function PATCH(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0].message);
  const { contactId, nickname, notes } = parsed.data;
  try {
    await db.update(contacts)
      .set({
        ...(nickname !== undefined ? { nickname } : {}),
        ...(notes !== undefined ? { notes } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(contacts.ownerId, user.id), eq(contacts.contactId, contactId)));
    return ok({ updated: true });
  } catch (e) {
    return serverError("Failed to update contact", e);
  }
}

/** DELETE /api/contacts — remove a contact */
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  const body = await req.json().catch(() => null);
  const parsed = z.object({ contactId: z.string().uuid() }).safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0].message);
  try {
    await db.delete(contacts).where(
      and(eq(contacts.ownerId, user.id), eq(contacts.contactId, parsed.data.contactId))
    );
    return ok({ removed: true });
  } catch (e) {
    return serverError("Failed to remove contact", e);
  }
}
