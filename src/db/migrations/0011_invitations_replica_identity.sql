-- ============================================================
-- Fix: Invitation Realtime not firing
-- ============================================================
-- The invitations table was missing REPLICA IDENTITY FULL,
-- which Supabase Realtime needs to evaluate column filters
-- on UPDATE/DELETE events. Without it, the subscription with
-- a filter on `invited_email` fails silently.
-- ============================================================

ALTER TABLE invitations REPLICA IDENTITY FULL;
