-- ============================================================
-- Fix: memberships Realtime not firing on INSERT
-- ============================================================
-- Two issues:
-- 1. memberships was missing REPLICA IDENTITY FULL — Realtime
--    needs it to evaluate RLS on INSERT/UPDATE/DELETE events.
-- 2. memberships_admin_manage used a correlated sub-query into
--    memberships itself, which Supabase Realtime cannot evaluate
--    and silently drops. Replace with a SECURITY DEFINER helper
--    (same pattern used in 0008 for messages/chats).
-- ============================================================

-- 1. REPLICA IDENTITY FULL so Realtime carries all columns
ALTER TABLE memberships REPLICA IDENTITY FULL;

-- 2. Helper: returns TRUE if the current user is an admin of the chat
CREATE OR REPLACE FUNCTION is_chat_admin(p_chat_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships
    WHERE user_id = auth.uid()
      AND chat_id = p_chat_id
      AND role = 'admin'
  );
$$;

-- 3. Replace the admin manage policy with SECURITY DEFINER function
DROP POLICY IF EXISTS "memberships_admin_manage" ON memberships;
CREATE POLICY "memberships_admin_manage" ON memberships
  FOR ALL USING (is_chat_admin(chat_id));
