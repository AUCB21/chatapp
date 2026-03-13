-- ============================================================
-- Fix messages SELECT RLS for Supabase Realtime compatibility
-- ============================================================
-- The old `messages_select_members` policy used a sub-query:
--   chat_id IN (SELECT chat_id FROM memberships WHERE …)
-- Supabase Realtime cannot evaluate sub-queries in RLS policies
-- and silently drops events. Replace with a SECURITY DEFINER
-- function call that Realtime can evaluate.
-- ============================================================

-- 1. Helper function: returns TRUE if the current user is a member of the chat
CREATE OR REPLACE FUNCTION is_chat_member(p_chat_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships
    WHERE user_id = auth.uid()
      AND chat_id = p_chat_id
  );
$$;

-- 2. Replace the messages SELECT policy
DROP POLICY IF EXISTS "messages_select_members" ON messages;
CREATE POLICY "messages_select_members" ON messages
  FOR SELECT USING (is_chat_member(chat_id));

-- 3. Also fix the chats SELECT policy (same sub-query problem)
DROP POLICY IF EXISTS "chats_select_members_only" ON chats;
CREATE POLICY "chats_select_members_only" ON chats
  FOR SELECT USING (is_chat_member(id));

-- 4. REPLICA IDENTITY FULL on messages so Realtime can deliver
--    UPDATE events with all columns (for status changes, edits).
ALTER TABLE messages REPLICA IDENTITY FULL;
