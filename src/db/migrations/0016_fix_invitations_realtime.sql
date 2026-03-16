-- ============================================================
-- Fix: invitations Realtime not firing on INSERT
-- ============================================================
-- The invitations_select_invitee policy used a sub-query into
-- auth.users to resolve invited_email → uid. Supabase Realtime
-- cannot evaluate sub-queries in RLS policies and silently drops
-- the event. Replace with a SECURITY DEFINER function.
-- ============================================================

-- Helper: returns TRUE if the current user is the invitee
CREATE OR REPLACE FUNCTION is_invited(p_invited_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT p_invited_email = (
    SELECT email FROM auth.users WHERE id = auth.uid()
  );
$$;

-- Replace invitee SELECT policy
DROP POLICY IF EXISTS "invitations_select_invitee" ON invitations;
CREATE POLICY "invitations_select_invitee" ON invitations
  FOR SELECT USING (is_invited(invited_email));

-- Replace invitee UPDATE policy (accept/decline)
DROP POLICY IF EXISTS "invitations_update_own" ON invitations;
CREATE POLICY "invitations_update_own" ON invitations
  FOR UPDATE USING (is_invited(invited_email));
