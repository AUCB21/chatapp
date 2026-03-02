-- ============================================================
-- Realtime Publication Setup
-- ============================================================
-- This adds tables to the supabase_realtime publication so that
-- postgres_changes events are broadcast to subscribed clients.
-- Without this, Realtime will show SUBSCRIBED but callbacks won't fire.

-- Add all tables that need real-time updates to the publication
ALTER PUBLICATION supabase_realtime ADD TABLE chats;
ALTER PUBLICATION supabase_realtime ADD TABLE memberships;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE invitations;

-- Verify publication (for debugging)
-- You can run: SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
