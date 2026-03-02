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
