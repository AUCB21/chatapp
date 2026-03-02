-- ============================================================
-- Realtime Permissions Setup
-- ============================================================
-- Grant SELECT to supabase_realtime_admin so the Realtime server
-- can read changes and broadcast them to subscribed clients.
-- This is required for postgres_changes events to fire.

-- Grant SELECT permissions to Realtime role
GRANT SELECT ON chats TO supabase_realtime_admin;
GRANT SELECT ON memberships TO supabase_realtime_admin;
GRANT SELECT ON messages TO supabase_realtime_admin;
GRANT SELECT ON invitations TO supabase_realtime_admin;

-- Also grant USAGE on sequences for complete access
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO supabase_realtime_admin;

-- Verify setup (for debugging)
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
-- SELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE table_name = 'messages';
