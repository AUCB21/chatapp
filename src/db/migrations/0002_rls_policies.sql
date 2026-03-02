-- ============================================================
-- RLS Policies, Foreign Keys & Indexes
-- ============================================================
-- Consolidates rls_policies.sql + update_rls_performance.sql
-- All statements are idempotent (safe to re-run).
-- ============================================================

-- 1. Foreign Keys to auth.users (outside Drizzle's scope)
DO $$ BEGIN
  ALTER TABLE memberships
    ADD CONSTRAINT memberships_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE messages
    ADD CONSTRAINT messages_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Enable RLS (idempotent)
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 3. Policies (DROP IF EXISTS + CREATE for idempotency)
DROP POLICY IF EXISTS "chats_select_members_only" ON chats;
CREATE POLICY "chats_select_members_only" ON chats
  FOR SELECT USING (
    id IN (
      SELECT chat_id FROM memberships
      WHERE user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "memberships_select_own" ON memberships;
CREATE POLICY "memberships_select_own" ON memberships
  FOR SELECT USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "memberships_admin_manage" ON memberships;
CREATE POLICY "memberships_admin_manage" ON memberships
  FOR ALL USING (
    chat_id IN (
      SELECT chat_id FROM memberships
      WHERE user_id = (SELECT auth.uid())
        AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "messages_select_members" ON messages;
CREATE POLICY "messages_select_members" ON messages
  FOR SELECT USING (
    chat_id IN (
      SELECT chat_id FROM memberships
      WHERE user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "messages_insert_write_members" ON messages;
CREATE POLICY "messages_insert_write_members" ON messages
  FOR INSERT WITH CHECK (
    chat_id IN (
      SELECT chat_id FROM memberships
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('write', 'admin')
    )
  );

-- 4. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_chat_id ON memberships(chat_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user_role ON memberships(user_id, role);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat_created ON messages(chat_id, created_at);
