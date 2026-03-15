-- Attachments table for file/image sharing in messages.
-- Stored in Supabase Storage bucket "chat-attachments".

CREATE TABLE IF NOT EXISTS attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS attachments_message_idx ON attachments(message_id);

-- RLS
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

-- SELECT: chat members can view attachments
CREATE POLICY attachments_select ON attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN memberships mb ON mb.chat_id = m.chat_id
      WHERE m.id = attachments.message_id
        AND mb.user_id = auth.uid()
    )
  );

-- INSERT: restricted to service role (uploads go through API proxy)
-- No INSERT policy for authenticated users — server uses service role key.

-- DELETE: message author or admin can delete attachments
CREATE POLICY attachments_delete ON attachments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN memberships mb ON mb.chat_id = m.chat_id
      WHERE m.id = attachments.message_id
        AND mb.user_id = auth.uid()
        AND (m.user_id = auth.uid() OR mb.role = 'admin')
    )
  );

-- Add attachments to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE attachments;
