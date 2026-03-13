-- ============================================================
-- Add unread_count to memberships + auto-increment trigger
-- ============================================================
-- Moves unread counting from a complex JOIN query to a simple
-- column read. A trigger increments counts for all members
-- (except the sender) on each message INSERT. markRead resets
-- the counter to 0 via application code.
-- ============================================================

-- 1. Add the column (idempotent)
DO $$ BEGIN
  ALTER TABLE memberships ADD COLUMN unread_count integer NOT NULL DEFAULT 0;
  EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 2. Backfill existing unread counts from read_receipts
--    For each membership, count messages from other users that
--    arrived after the member's last read receipt (or all if none).
UPDATE memberships m
SET unread_count = COALESCE(sub.cnt, 0)
FROM (
  SELECT
    mb.user_id,
    mb.chat_id,
    count(msg.id)::int AS cnt
  FROM memberships mb
  INNER JOIN messages msg
    ON msg.chat_id = mb.chat_id
    AND msg.user_id != mb.user_id
    AND msg.deleted_at IS NULL
  LEFT JOIN read_receipts rr
    ON rr.chat_id = mb.chat_id
    AND rr.user_id = mb.user_id
  WHERE rr.last_read_at IS NULL
     OR msg.created_at > rr.last_read_at
  GROUP BY mb.user_id, mb.chat_id
) sub
WHERE m.user_id = sub.user_id
  AND m.chat_id = sub.chat_id;

-- 3. Trigger function: increment unread_count for all members except sender
CREATE OR REPLACE FUNCTION increment_unread_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE memberships
  SET unread_count = unread_count + 1
  WHERE chat_id = NEW.chat_id
    AND user_id != NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Attach trigger (drop first for idempotency)
DROP TRIGGER IF EXISTS trg_increment_unread ON messages;
CREATE TRIGGER trg_increment_unread
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION increment_unread_on_message();

-- 5. REPLICA IDENTITY FULL so Supabase Realtime can deliver
--    UPDATE events with all columns (needed for filtered subscriptions).
ALTER TABLE memberships REPLICA IDENTITY FULL;

-- 6. Split memberships_admin_manage (FOR ALL) into separate
--    INSERT/UPDATE/DELETE policies. The original FOR ALL policy included
--    SELECT with a complex sub-query, which prevents Supabase Realtime
--    from evaluating RLS and silently drops events. By splitting it,
--    only memberships_select_own (simple: user_id = auth.uid()) applies
--    to SELECT operations, which Realtime can evaluate.
DROP POLICY IF EXISTS "memberships_admin_manage" ON memberships;

CREATE POLICY "memberships_admin_insert" ON memberships
  FOR INSERT WITH CHECK (
    chat_id IN (
      SELECT chat_id FROM memberships
      WHERE user_id = (SELECT auth.uid())
        AND role = 'admin'
    )
  );

CREATE POLICY "memberships_admin_update" ON memberships
  FOR UPDATE USING (
    chat_id IN (
      SELECT chat_id FROM memberships
      WHERE user_id = (SELECT auth.uid())
        AND role = 'admin'
    )
  );

CREATE POLICY "memberships_admin_delete" ON memberships
  FOR DELETE USING (
    chat_id IN (
      SELECT chat_id FROM memberships
      WHERE user_id = (SELECT auth.uid())
        AND role = 'admin'
    )
  );
