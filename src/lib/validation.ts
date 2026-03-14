import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const createChatSchema = z.object({
  name: z.string().min(1).max(100).trim(),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(4000).trim(),
  parentId: z.string().uuid().optional(),
});

export const editMessageSchema = z.object({
  content: z.string().min(1).max(4000).trim(),
});

export const deleteMessageSchema = z.object({
  messageId: z.string().uuid(),
  mode: z.enum(["for_me", "for_everyone"]).optional(),
});

export const syncDeletedMessagesSchema = z.object({
  messageIds: z.array(z.string().uuid()).max(2000),
});

export const reactionSchema = z.object({
  emoji: z.string().min(1).max(8), // single emoji
});

export const addMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["read", "write", "admin"]),
});

export const updateMemberSchema = z.object({
  role: z.enum(["read", "write", "admin"]),
});

export const createInviteSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("direct"),
    invitedEmail: z.string().email(),
  }),
  z.object({
    type: z.literal("group"),
    chatName: z.string().min(1).max(100).trim(),
    invitedEmails: z.array(z.string().email()).max(50).optional(),
  }),
]);

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex color like #ff00aa")
  .nullable()
  .optional();

export const updateProfileSchema = z.object({
  username: z.string().min(1).max(50).trim().optional(),
  displayName: z.string().min(1).max(80).trim().optional(),
  status: z.enum(["online", "idle", "dnd"]).optional(),
  accentBg: hexColor,
  accentFont: hexColor,
  accentChat: hexColor,
});
