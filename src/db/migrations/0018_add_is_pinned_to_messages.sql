-- ============================================================
-- Add is_pinned boolean to messages table
-- Replaces the pinned_messages join-table approach with a
-- simple flag on the message itself. Supabase Realtime fires
-- the existing messages UPDATE subscription automatically,
-- so no extra subscriptions or broadcasts are needed.
-- ============================================================

ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;

-- Partial index for fast "find pinned message per chat" lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_pinned_per_chat
  ON messages (chat_id)
  WHERE is_pinned = true;
