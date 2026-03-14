-- Add chat_type enum and type column to chats
-- Make name nullable (direct chats have no name; group chats require one)

DO $$ BEGIN
  CREATE TYPE chat_type AS ENUM ('direct', 'group');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE chats
  ADD COLUMN IF NOT EXISTS type chat_type NOT NULL DEFAULT 'group';

ALTER TABLE chats
  ALTER COLUMN name DROP NOT NULL;
