-- ============================================================
-- Server-backed delete-for-me persistence
-- ============================================================

CREATE TABLE IF NOT EXISTS deleted_for_me (
  user_id uuid NOT NULL,
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  created_at timestamp DEFAULT now() NOT NULL,
  PRIMARY KEY (user_id, message_id)
);

DO $$ BEGIN
  ALTER TABLE deleted_for_me
    ADD CONSTRAINT deleted_for_me_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_deleted_for_me_user_id ON deleted_for_me(user_id);
CREATE INDEX IF NOT EXISTS idx_deleted_for_me_message_id ON deleted_for_me(message_id);

ALTER TABLE deleted_for_me ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deleted_for_me_select_own" ON deleted_for_me;
CREATE POLICY "deleted_for_me_select_own" ON deleted_for_me
  FOR SELECT USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "deleted_for_me_insert_own" ON deleted_for_me;
CREATE POLICY "deleted_for_me_insert_own" ON deleted_for_me
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE deleted_for_me;
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT SELECT ON deleted_for_me TO supabase_realtime_admin;