-- Run this once in the Supabase SQL Editor.
CREATE TABLE IF NOT EXISTS support_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_role VARCHAR(20) NOT NULL CHECK (sender_role IN ('user', 'admin', 'system')),
  message TEXT NOT NULL CHECK (length(trim(message)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_user_created
  ON support_messages(user_id, created_at);
