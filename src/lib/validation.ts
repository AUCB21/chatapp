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

export const createInviteSchema = z.object({
  chatName: z.string().min(1).max(100).trim(),
  invitedEmail: z.string().email().optional(),
});
