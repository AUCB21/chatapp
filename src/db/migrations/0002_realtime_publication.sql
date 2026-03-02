-- ============================================================
-- Realtime Permissions Setup
-- ============================================================
-- Two things are required for postgres_changes events to fire:
--
-- 1. Tables must be in the `supabase_realtime` publication
--    (tells PostgreSQL WAL to stream changes to Realtime)
--
-- 2. The `supabase_realtime_admin` role must have SELECT
--    (lets the Realtime server read rows for RLS evaluation)
-- ============================================================

-- 1. Add tables to the Realtime publication (idempotent — skips if already added)
--    Without this, Realtime receives ZERO change events.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE chats;
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE memberships;
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE invitations;
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Grant SELECT permissions to Realtime role
GRANT SELECT ON chats TO supabase_realtime_admin;
GRANT SELECT ON memberships TO supabase_realtime_admin;
GRANT SELECT ON messages TO supabase_realtime_admin;
GRANT SELECT ON invitations TO supabase_realtime_admin;

-- Also grant USAGE on sequences for complete access
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO supabase_realtime_admin;

-- Verify setup (run manually in SQL Editor for debugging)
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
-- SELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE table_name = 'messages';
