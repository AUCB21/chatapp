-- ============================================================
-- 1. Foreign Keys to auth.users (outside Drizzle's scope)
-- ============================================================

ALTER TABLE memberships
  ADD CONSTRAINT memberships_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE messages
  ADD CONSTRAINT messages_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================
-- 2. Row Level Security
-- ============================================================

ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- CHATS: only members can see the chat
-- Performance: auth.uid() wrapped in SELECT to avoid per-row re-evaluation
CREATE POLICY "chats_select_members_only" ON chats
  FOR SELECT USING (
    id IN (
      SELECT chat_id FROM memberships
      WHERE user_id = (SELECT auth.uid())
    )
  );

-- MEMBERSHIPS: users see only their own memberships
-- Performance: auth.uid() wrapped in SELECT to avoid per-row re-evaluation
CREATE POLICY "memberships_select_own" ON memberships
  FOR SELECT USING (user_id = (SELECT auth.uid()));

-- MEMBERSHIPS: admin can manage members of their chats
-- Performance: auth.uid() wrapped in SELECT to avoid per-row re-evaluation
CREATE POLICY "memberships_admin_manage" ON memberships
  FOR ALL USING (
    chat_id IN (
      SELECT chat_id FROM memberships
      WHERE user_id = (SELECT auth.uid())
        AND role = 'admin'
    )
  );

-- MESSAGES: membership is the only condition
-- Performance: auth.uid() wrapped in SELECT to avoid per-row re-evaluation
CREATE POLICY "messages_select_members" ON messages
  FOR SELECT USING (
    chat_id IN (
      SELECT chat_id FROM memberships
      WHERE user_id = (SELECT auth.uid())
    )
  );

-- MESSAGES: write or admin can insert
-- Performance: auth.uid() wrapped in SELECT to avoid per-row re-evaluation
CREATE POLICY "messages_insert_write_members" ON messages
  FOR INSERT WITH CHECK (
    chat_id IN (
      SELECT chat_id FROM memberships
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('write', 'admin')
    )
  );

-- ============================================================
-- 3. Performance Indexes for RLS Policies
-- ============================================================

-- Index for memberships lookups by user_id (used in all RLS policies)
CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON memberships(user_id);

-- Index for memberships lookups by chat_id (used in admin checks and joins)
CREATE INDEX IF NOT EXISTS idx_memberships_chat_id ON memberships(chat_id);

-- Composite index for user+role checks (used in messages insert policy)
CREATE INDEX IF NOT EXISTS idx_memberships_user_role ON memberships(user_id, role);

-- Index for messages by chat_id (used in SELECT policies)
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);

-- Index for messages by user_id (useful for user-specific queries)
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);

-- Composite index for chat+timestamp (useful for ordered message fetching)
CREATE INDEX IF NOT EXISTS idx_messages_chat_created ON messages(chat_id, created_at);
