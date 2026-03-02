-- ============================================================
-- RLS Policy Performance Update
-- ============================================================
-- This migration updates existing RLS policies to improve performance
-- by wrapping auth.uid() calls in SELECT subqueries.
-- 
-- Run this in Supabase SQL Editor or via migration tool.
-- ============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "chats_select_members_only" ON chats;
DROP POLICY IF EXISTS "memberships_select_own" ON memberships;
DROP POLICY IF EXISTS "memberships_admin_manage" ON memberships;
DROP POLICY IF EXISTS "messages_select_members" ON messages;
DROP POLICY IF EXISTS "messages_insert_write_members" ON messages;

-- Recreate policies with performance optimizations
-- Performance: auth.uid() wrapped in SELECT to avoid per-row re-evaluation

CREATE POLICY "chats_select_members_only" ON chats
  FOR SELECT USING (
    id IN (
      SELECT chat_id FROM memberships
      WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "memberships_select_own" ON memberships
  FOR SELECT USING (user_id = (SELECT auth.uid()));

CREATE POLICY "memberships_admin_manage" ON memberships
  FOR ALL USING (
    chat_id IN (
      SELECT chat_id FROM memberships
      WHERE user_id = (SELECT auth.uid())
        AND role = 'admin'
    )
  );

CREATE POLICY "messages_select_members" ON messages
  FOR SELECT USING (
    chat_id IN (
      SELECT chat_id FROM memberships
      WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "messages_insert_write_members" ON messages
  FOR INSERT WITH CHECK (
    chat_id IN (
      SELECT chat_id FROM memberships
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('write', 'admin')
    )
  );

-- Add performance indexes
CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_chat_id ON memberships(chat_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user_role ON memberships(user_id, role);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat_created ON messages(chat_id, created_at);

-- Verify policies are enabled
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
