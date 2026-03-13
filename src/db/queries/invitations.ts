import { and, eq } from "drizzle-orm";
import { db } from "../index";
import { chats, memberships, invitations } from "../schema";
import { randomBytes } from "crypto";

const TOKEN_BYTES = 32;
const EXPIRY_DAYS = 7;

function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString("hex");
}

function expiresAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + EXPIRY_DAYS);
  return d;
}

/**
 * Creates a chat (creator = admin) and an invitation record in one transaction.
 */
export async function createChatWithInvitation(
  chatName: string,
  creatorId: string,
  invitedEmail?: string
) {
  return db.transaction(async (tx) => {
    const [chat] = await tx.insert(chats).values({ name: chatName }).returning();

    await tx.insert(memberships).values({
      userId: creatorId,
      chatId: chat.id,
      role: "admin",
    });

    const token = generateToken();

    const [invitation] = await tx
      .insert(invitations)
      .values({
        chatId: chat.id,
        invitedByUserId: creatorId,
        invitedEmail:
          invitedEmail?.toLowerCase() ?? `link+${token}@invite.local`,
        token,
        expiresAt: expiresAt(),
      })
      .returning();

    return { chat, invitation };
  });
}

/**
 * Returns all pending invitations for a given email address.
 * Used to surface invited-but-not-yet-joined chats in the sidebar.
 */
export async function getPendingInvitationsForEmail(email: string) {
  return db
    .select({
      chatId: invitations.chatId,
      chatName: chats.name,
      chatCreatedAt: chats.createdAt,
    })
    .from(invitations)
    .innerJoin(chats, eq(chats.id, invitations.chatId))
    .where(
      and(
        eq(invitations.invitedEmail, email.toLowerCase()),
        eq(invitations.status, "pending")
      )
    );
}

/**
 * Accepts a pending invitation: adds the user as a write member.
 */
export async function acceptInvitationByChatAndEmail(
  chatId: string,
  userId: string,
  userEmail: string
): Promise<{ ok: true } | { error: string }> {
  return db.transaction(async (tx) => {
    const result = await tx
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.chatId, chatId),
          eq(invitations.invitedEmail, userEmail.toLowerCase()),
          eq(invitations.status, "pending")
        )
      )
      .limit(1);

    const inv = result[0];
    if (!inv) return { error: "No pending invitation found" };

    await tx
      .insert(memberships)
      .values({ userId, chatId, role: "write" })
      .onConflictDoUpdate({
        target: [memberships.userId, memberships.chatId],
        set: { role: "write" },
      });

    await tx
      .update(invitations)
      .set({ status: "accepted" })
      .where(eq(invitations.id, inv.id));

    return { ok: true };
  });
}

/**
 * Declines a pending invitation without adding the user to the chat.
 */
export async function declineInvitationByChatAndEmail(
  chatId: string,
  userEmail: string
): Promise<{ ok: true } | { error: string }> {
  return db.transaction(async (tx) => {
    const result = await tx
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.chatId, chatId),
          eq(invitations.invitedEmail, userEmail.toLowerCase()),
          eq(invitations.status, "pending")
        )
      )
      .limit(1);

    const inv = result[0];
    if (!inv) return { error: "No pending invitation found" };

    await tx
      .update(invitations)
      .set({ status: "declined" })
      .where(eq(invitations.id, inv.id));

    return { ok: true };
  });
}

/**
 * Returns pending invitation metadata by token.
 */
export async function getPendingInvitationByToken(token: string) {
  const result = await db
    .select({
      invitationId: invitations.id,
      chatId: invitations.chatId,
      chatName: chats.name,
      status: invitations.status,
      expiresAt: invitations.expiresAt,
    })
    .from(invitations)
    .innerJoin(chats, eq(chats.id, invitations.chatId))
    .where(eq(invitations.token, token))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Accepts a pending invitation using a token.
 */
export async function acceptInvitationByToken(
  token: string,
  userId: string
): Promise<{ ok: true; chatId: string } | { error: string }> {
  return db.transaction(async (tx) => {
    const result = await tx
      .select()
      .from(invitations)
      .where(eq(invitations.token, token))
      .limit(1);

    const inv = result[0];
    if (!inv) return { error: "Invitation not found" };
    if (inv.status !== "pending") return { error: "Invitation is no longer pending" };
    if (inv.expiresAt.getTime() <= Date.now()) return { error: "Invitation has expired" };

    await tx
      .insert(memberships)
      .values({ userId, chatId: inv.chatId, role: "write" })
      .onConflictDoNothing({
        target: [memberships.userId, memberships.chatId],
      });

    await tx
      .update(invitations)
      .set({ status: "accepted" })
      .where(eq(invitations.id, inv.id));

    return { ok: true, chatId: inv.chatId };
  });
}
