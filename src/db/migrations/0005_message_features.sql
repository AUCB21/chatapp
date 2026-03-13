-- Migration: Add message states, reactions, threaded replies, read receipts

-- 1. Message status enum
DO $$ BEGIN
  CREATE TYPE message_status AS ENUM ('sent', 'delivered', 'read');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Add new columns to messages table
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS status message_status NOT NULL DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS messages_parent_idx ON messages(parent_id);

-- 3. Read receipts table
CREATE TABLE IF NOT EXISTS read_receipts (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, chat_id)
);

-- 4. Reactions table
CREATE TABLE IF NOT EXISTS reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reactions_message_idx ON reactions(message_id);
CREATE UNIQUE INDEX IF NOT EXISTS reactions_unique_idx ON reactions(message_id, user_id, emoji);

-- 5. Full-text search index on messages content
ALTER TABLE messages ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED;
CREATE INDEX IF NOT EXISTS messages_search_idx ON messages USING GIN(search_vector);

-- 6. RLS policies for new tables
ALTER TABLE read_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

-- Read receipts: users can read/write their own receipts for chats they're in
CREATE POLICY "read_receipts_select" ON read_receipts
  FOR SELECT USING (
    user_id = auth.uid()
    OR chat_id IN (SELECT chat_id FROM memberships WHERE user_id = auth.uid())
  );

CREATE POLICY "read_receipts_upsert" ON read_receipts
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "read_receipts_update" ON read_receipts
  FOR UPDATE USING (user_id = auth.uid());

-- Reactions: members can see all reactions, add/remove their own
CREATE POLICY "reactions_select" ON reactions
  FOR SELECT USING (
    message_id IN (
      SELECT m.id FROM messages m
      JOIN memberships mb ON mb.chat_id = m.chat_id
      WHERE mb.user_id = auth.uid()
    )
  );

CREATE POLICY "reactions_insert" ON reactions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "reactions_delete" ON reactions
  FOR DELETE USING (user_id = auth.uid());

-- 7. Add to Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE read_receipts;
ALTER PUBLICATION supabase_realtime ADD TABLE reactions;
