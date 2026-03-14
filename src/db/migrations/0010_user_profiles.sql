-- 0010: user_profiles table for extended user settings
-- Stores username, display name, avatar, status, and accent colors.

-- Enum for user status
DO $$ BEGIN
  CREATE TYPE user_status AS ENUM ('online', 'idle', 'dnd');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- User profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  status user_status NOT NULL DEFAULT 'online',
  accent_bg TEXT,
  accent_font TEXT,
  accent_chat TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS policies
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can read any profile (needed to display names in chats)
DROP POLICY IF EXISTS "user_profiles_select" ON user_profiles;
CREATE POLICY "user_profiles_select" ON user_profiles
  FOR SELECT USING (true);

-- Users can only update their own profile
DROP POLICY IF EXISTS "user_profiles_update" ON user_profiles;
CREATE POLICY "user_profiles_update" ON user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can insert their own profile
DROP POLICY IF EXISTS "user_profiles_insert" ON user_profiles;
CREATE POLICY "user_profiles_insert" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own profile
DROP POLICY IF EXISTS "user_profiles_delete" ON user_profiles;
CREATE POLICY "user_profiles_delete" ON user_profiles
  FOR DELETE USING (auth.uid() = user_id);

-- Add to realtime publication so status changes are visible
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE user_profiles;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
