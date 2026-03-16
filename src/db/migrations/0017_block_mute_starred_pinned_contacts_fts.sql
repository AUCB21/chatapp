-- ============================================================
-- #45 Block/Mute Users
-- #53 Contacts Master Data
-- #54 Starred Messages
-- #55 Pin Messages
-- #47 Full-Text Search (tsvector index on messages)
-- ============================================================

-- ── #45 blocked_users ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blocked_users (
  blocker_id  uuid NOT NULL,  -- FK → auth.users(id)
  blocked_id  uuid NOT NULL,  -- FK → auth.users(id)
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker ON blocked_users(blocker_id);

ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_users REPLICA IDENTITY FULL;

-- Users can manage their own block list
DROP POLICY IF EXISTS "blocked_users_select_own" ON blocked_users;
CREATE POLICY "blocked_users_select_own" ON blocked_users
  FOR SELECT USING (blocker_id = auth.uid());

DROP POLICY IF EXISTS "blocked_users_insert_own" ON blocked_users;
CREATE POLICY "blocked_users_insert_own" ON blocked_users
  FOR INSERT WITH CHECK (blocker_id = auth.uid());

DROP POLICY IF EXISTS "blocked_users_delete_own" ON blocked_users;
CREATE POLICY "blocked_users_delete_own" ON blocked_users
  FOR DELETE USING (blocker_id = auth.uid());

-- ── #53 contacts ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  owner_id    uuid NOT NULL,  -- FK → auth.users(id)
  contact_id  uuid NOT NULL,  -- FK → auth.users(id)
  nickname    text,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, contact_id)
);
CREATE INDEX IF NOT EXISTS idx_contacts_owner ON contacts(owner_id);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts REPLICA IDENTITY FULL;

DROP POLICY IF EXISTS "contacts_select_own" ON contacts;
CREATE POLICY "contacts_select_own" ON contacts
  FOR SELECT USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "contacts_insert_own" ON contacts;
CREATE POLICY "contacts_insert_own" ON contacts
  FOR INSERT WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "contacts_update_own" ON contacts;
CREATE POLICY "contacts_update_own" ON contacts
  FOR UPDATE USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "contacts_delete_own" ON contacts;
CREATE POLICY "contacts_delete_own" ON contacts
  FOR DELETE USING (owner_id = auth.uid());

-- ── #54 starred_messages ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS starred_messages (
  user_id     uuid NOT NULL,  -- FK → auth.users(id)
  message_id  uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, message_id)
);
CREATE INDEX IF NOT EXISTS idx_starred_messages_user ON starred_messages(user_id);

ALTER TABLE starred_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE starred_messages REPLICA IDENTITY FULL;

DROP POLICY IF EXISTS "starred_messages_select_own" ON starred_messages;
CREATE POLICY "starred_messages_select_own" ON starred_messages
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "starred_messages_insert_own" ON starred_messages;
CREATE POLICY "starred_messages_insert_own" ON starred_messages
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "starred_messages_delete_own" ON starred_messages;
CREATE POLICY "starred_messages_delete_own" ON starred_messages
  FOR DELETE USING (user_id = auth.uid());

-- ── #55 pinned_messages ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS pinned_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id     uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  message_id  uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  pinned_by   uuid NOT NULL,  -- FK → auth.users(id)
  pinned_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chat_id, message_id)
);
CREATE INDEX IF NOT EXISTS idx_pinned_messages_chat ON pinned_messages(chat_id);

ALTER TABLE pinned_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE pinned_messages REPLICA IDENTITY FULL;

-- Members can read pins in their chats
CREATE OR REPLACE FUNCTION is_chat_member_for_pin(p_chat_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM memberships WHERE user_id = auth.uid() AND chat_id = p_chat_id);
$$;

DROP POLICY IF EXISTS "pinned_messages_select_members" ON pinned_messages;
CREATE POLICY "pinned_messages_select_members" ON pinned_messages
  FOR SELECT USING (is_chat_member_for_pin(chat_id));

-- Only admins can insert/delete pins (enforced server-side too)
DROP POLICY IF EXISTS "pinned_messages_admin_write" ON pinned_messages;
CREATE POLICY "pinned_messages_admin_write" ON pinned_messages
  FOR ALL USING (is_chat_admin(chat_id));

-- ── #47 Full-Text Search ─────────────────────────────────────
-- Add tsvector column + GIN index + trigger to auto-update
ALTER TABLE messages ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED;

CREATE INDEX IF NOT EXISTS idx_messages_fts ON messages USING GIN(fts);

-- ── Realtime publications ────────────────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE pinned_messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE starred_messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT SELECT ON blocked_users TO supabase_realtime_admin;
GRANT SELECT ON contacts TO supabase_realtime_admin;
GRANT SELECT ON starred_messages TO supabase_realtime_admin;
GRANT SELECT ON pinned_messages TO supabase_realtime_admin;
