-- Migration: group call sessions and participants

-- 1. Enums
DO $$ BEGIN
  CREATE TYPE call_status AS ENUM ('ringing', 'active', 'ended');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE call_participant_role AS ENUM ('host', 'participant');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE call_participant_state AS ENUM ('joined', 'left');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Tables
CREATE TABLE IF NOT EXISTS call_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  created_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status call_status NOT NULL DEFAULT 'ringing',
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS call_participants (
  call_id uuid NOT NULL REFERENCES call_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role call_participant_role NOT NULL DEFAULT 'participant',
  state call_participant_state NOT NULL DEFAULT 'joined',
  is_muted boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  PRIMARY KEY (call_id, user_id)
);

CREATE INDEX IF NOT EXISTS call_sessions_chat_idx ON call_sessions(chat_id);
CREATE INDEX IF NOT EXISTS call_sessions_status_idx ON call_sessions(status);
CREATE INDEX IF NOT EXISTS call_participants_user_idx ON call_participants(user_id);
CREATE INDEX IF NOT EXISTS call_participants_state_idx ON call_participants(state);

-- 3. RLS
ALTER TABLE call_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "call_sessions_select_members" ON call_sessions;
CREATE POLICY "call_sessions_select_members" ON call_sessions
  FOR SELECT USING (
    chat_id IN (
      SELECT chat_id FROM memberships
      WHERE user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "call_sessions_insert_write_members" ON call_sessions;
CREATE POLICY "call_sessions_insert_write_members" ON call_sessions
  FOR INSERT WITH CHECK (
    created_by_user_id = (SELECT auth.uid())
    AND chat_id IN (
      SELECT chat_id FROM memberships
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('write', 'admin')
    )
  );

DROP POLICY IF EXISTS "call_sessions_update_host_or_admin" ON call_sessions;
CREATE POLICY "call_sessions_update_host_or_admin" ON call_sessions
  FOR UPDATE USING (
    created_by_user_id = (SELECT auth.uid())
    OR chat_id IN (
      SELECT chat_id FROM memberships
      WHERE user_id = (SELECT auth.uid())
        AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "call_participants_select_members" ON call_participants;
CREATE POLICY "call_participants_select_members" ON call_participants
  FOR SELECT USING (
    call_id IN (
      SELECT cs.id FROM call_sessions cs
      JOIN memberships mb ON mb.chat_id = cs.chat_id
      WHERE mb.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "call_participants_insert_self" ON call_participants;
CREATE POLICY "call_participants_insert_self" ON call_participants
  FOR INSERT WITH CHECK (
    user_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "call_participants_update_self_or_host" ON call_participants;
CREATE POLICY "call_participants_update_self_or_host" ON call_participants
  FOR UPDATE USING (
    user_id = (SELECT auth.uid())
    OR call_id IN (
      SELECT cs.id FROM call_sessions cs
      WHERE cs.created_by_user_id = (SELECT auth.uid())
    )
  );

-- 4. Realtime publication
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE call_sessions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE call_participants;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
