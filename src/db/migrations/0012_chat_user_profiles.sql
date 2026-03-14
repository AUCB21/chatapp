-- Per-chat display name / avatar overrides
-- Falls back to global user_profiles when not set.

CREATE TABLE IF NOT EXISTS chat_user_profiles (
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_id, user_id)
);

ALTER TABLE chat_user_profiles ENABLE ROW LEVEL SECURITY;

-- Any chat member can read overrides for their chats
CREATE POLICY "chat_user_profiles_select" ON chat_user_profiles
  FOR SELECT USING (
    chat_id IN (
      SELECT chat_id FROM memberships WHERE user_id = (SELECT auth.uid())
    )
  );

-- Users can set their own per-chat profile
CREATE POLICY "chat_user_profiles_upsert_self" ON chat_user_profiles
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "chat_user_profiles_update_self" ON chat_user_profiles
  FOR UPDATE USING (user_id = (SELECT auth.uid()));

-- Admins can set per-chat profiles for others
CREATE POLICY "chat_user_profiles_insert_admin" ON chat_user_profiles
  FOR INSERT WITH CHECK (
    chat_id IN (
      SELECT chat_id FROM memberships
      WHERE user_id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

CREATE POLICY "chat_user_profiles_update_admin" ON chat_user_profiles
  FOR UPDATE USING (
    chat_id IN (
      SELECT chat_id FROM memberships
      WHERE user_id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

CREATE POLICY "chat_user_profiles_delete" ON chat_user_profiles
  FOR DELETE USING (
    user_id = (SELECT auth.uid())
    OR chat_id IN (
      SELECT chat_id FROM memberships
      WHERE user_id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE chat_user_profiles;
