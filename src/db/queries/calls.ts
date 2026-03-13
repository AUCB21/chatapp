import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../index";
import {
  callParticipants,
  callSessions,
  type CallParticipantRole,
} from "../schema";

export async function getActiveCallForChat(chatId: string) {
  const rows = await db
    .select()
    .from(callSessions)
    .where(
      and(
        eq(callSessions.chatId, chatId),
        inArray(callSessions.status, ["ringing", "active"])
      )
    )
    .orderBy(desc(callSessions.createdAt))
    .limit(1);

  return rows[0] ?? null;
}

export async function getCallParticipants(callId: string) {
  return db
    .select()
    .from(callParticipants)
    .where(eq(callParticipants.callId, callId));
}

export async function createCallSession(chatId: string, creatorUserId: string) {
  return db.transaction(async (tx) => {
    const [session] = await tx
      .insert(callSessions)
      .values({
        chatId,
        createdByUserId: creatorUserId,
        status: "ringing",
      })
      .returning();

    await tx.insert(callParticipants).values({
      callId: session.id,
      userId: creatorUserId,
      role: "host",
      state: "joined",
      isMuted: false,
      leftAt: null,
    });

    return session;
  });
}

export async function joinCallSession(
  callId: string,
  userId: string,
  role: CallParticipantRole = "participant"
) {
  await db
    .insert(callParticipants)
    .values({
      callId,
      userId,
      role,
      state: "joined",
      isMuted: false,
      leftAt: null,
    })
    .onConflictDoUpdate({
      target: [callParticipants.callId, callParticipants.userId],
      set: {
        role,
        state: "joined",
        leftAt: null,
        joinedAt: sql`now()`,
      },
    });

  const [{ joinedCount }] = await db
    .select({ joinedCount: sql<number>`count(*)::int` })
    .from(callParticipants)
    .where(
      and(eq(callParticipants.callId, callId), eq(callParticipants.state, "joined"))
    );

  if ((joinedCount ?? 0) >= 2) {
    await db
      .update(callSessions)
      .set({
        status: "active",
        startedAt: sql`coalesce(${callSessions.startedAt}, now())`,
      })
      .where(eq(callSessions.id, callId));
  }

  const [participant] = await db
    .select()
    .from(callParticipants)
    .where(
      and(eq(callParticipants.callId, callId), eq(callParticipants.userId, userId))
    )
    .limit(1);

  return participant ?? null;
}

export async function setParticipantMute(
  callId: string,
  userId: string,
  isMuted: boolean
) {
  await db
    .update(callParticipants)
    .set({ isMuted })
    .where(
      and(eq(callParticipants.callId, callId), eq(callParticipants.userId, userId))
    );

  const [participant] = await db
    .select()
    .from(callParticipants)
    .where(
      and(eq(callParticipants.callId, callId), eq(callParticipants.userId, userId))
    )
    .limit(1);

  return participant ?? null;
}

export async function leaveCallSession(callId: string, userId: string) {
  await db
    .update(callParticipants)
    .set({ state: "left", leftAt: sql`now()` })
    .where(
      and(eq(callParticipants.callId, callId), eq(callParticipants.userId, userId))
    );

  const [{ joinedCount }] = await db
    .select({ joinedCount: sql<number>`count(*)::int` })
    .from(callParticipants)
    .where(
      and(eq(callParticipants.callId, callId), eq(callParticipants.state, "joined"))
    );

  if ((joinedCount ?? 0) === 0) {
    await endCallSession(callId);
  }
}

export async function endCallSession(callId: string) {
  await db.transaction(async (tx) => {
    await tx
      .update(callSessions)
      .set({ status: "ended", endedAt: sql`now()` })
      .where(eq(callSessions.id, callId));

    await tx
      .update(callParticipants)
      .set({ state: "left", leftAt: sql`coalesce(${callParticipants.leftAt}, now())` })
      .where(eq(callParticipants.callId, callId));
  });
}
