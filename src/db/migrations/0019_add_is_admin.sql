-- ============================================================
-- Add is_admin boolean to user_profiles table.
-- Defaults to false for all existing and new users.
-- Set to true via direct DB SQL in the Supabase dashboard:
--   UPDATE user_profiles SET is_admin = true WHERE user_id = '<uuid>';
-- ============================================================

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_user_profiles_is_admin
  ON user_profiles (is_admin)
  WHERE is_admin = true;
