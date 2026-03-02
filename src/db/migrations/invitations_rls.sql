-- ============================================================
-- RLS Policies for Invitations Table
-- ============================================================
-- Previously missing — without policies, RLS defaults to DENY ALL
-- which blocks Realtime events for invitations entirely.
-- ============================================================

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Invitees can see invitations sent to their email
CREATE POLICY "invitations_select_invitee" ON invitations
  FOR SELECT USING (
    invited_email = (
      SELECT email FROM auth.users WHERE id = (SELECT auth.uid())
    )
  );

-- Chat admins can see invitations they created
CREATE POLICY "invitations_select_creator" ON invitations
  FOR SELECT USING (
    invited_by_user_id = (SELECT auth.uid())
  );

-- Chat admins can insert invitations for chats they admin
CREATE POLICY "invitations_insert_admin" ON invitations
  FOR INSERT WITH CHECK (
    chat_id IN (
      SELECT chat_id FROM memberships
      WHERE user_id = (SELECT auth.uid())
        AND role = 'admin'
    )
  );

-- Chat admins can update invitation status (accept/decline handled by invitee)
CREATE POLICY "invitations_update_own" ON invitations
  FOR UPDATE USING (
    invited_email = (
      SELECT email FROM auth.users WHERE id = (SELECT auth.uid())
    )
  );

-- Performance index for email lookups in RLS
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(invited_email);
CREATE INDEX IF NOT EXISTS idx_invitations_invited_by ON invitations(invited_by_user_id);
