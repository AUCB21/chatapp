-- Add ToS + Privacy Policy consent timestamp to user_profiles
-- NULL = not yet consented (existing users pre-consent requirement)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS consented_at timestamptz;
