import { z } from "zod";

/**
 * Password must be at least 10 characters with uppercase, lowercase, and special character.
 */
export const passwordSchema = z
  .string()
  .min(10, "Must be at least 10 characters")
  .regex(/[A-Z]/, "Must contain an uppercase letter")
  .regex(/[a-z]/, "Must contain a lowercase letter")
  .regex(/[^A-Za-z0-9]/, "Must contain a special character");

/** Individual password rule checks for real-time UI feedback. */
export const PASSWORD_RULES = [
  { label: "At least 10 characters", test: (v: string) => v.length >= 10 },
  { label: "One uppercase letter", test: (v: string) => /[A-Z]/.test(v) },
  { label: "One lowercase letter", test: (v: string) => /[a-z]/.test(v) },
  { label: "One special character", test: (v: string) => /[^A-Za-z0-9]/.test(v) },
] as const;

export const registerSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
});

export const createChatSchema = z.object({
  name: z.string().min(1).max(100).trim(),
});

export const sendMessageSchema = z.object({
  content: z.string().max(4000).trim().default(""),
  parentId: z.string().uuid().optional(),
});

// File upload constants
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
export const MAX_FILES_PER_MESSAGE = 10;
export const ALLOWED_MIME_TYPES = new Set([
  // Images
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
  // Documents
  "application/pdf", "text/plain",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  // Media
  "video/mp4", "video/webm", "audio/mpeg", "audio/ogg", "audio/webm",
  // Code
  "text/html", "text/css", "text/javascript", "application/javascript",
  "application/json", "application/xml", "text/xml", "text/csv", "text/markdown",
  "application/x-yaml", "application/x-httpd-php", "application/x-sh",
  "application/x-python", "text/x-python",
]);

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
