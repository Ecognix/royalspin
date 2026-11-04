-- Run this once in the Supabase SQL Editor. Safe to rerun after partial application.
CREATE TABLE IF NOT EXISTS support_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES support_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_role VARCHAR(20) NOT NULL CHECK (sender_role IN ('user', 'admin', 'system')),
  message TEXT NOT NULL CHECK (length(trim(message)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE support_messages
  ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES support_conversations(id) ON DELETE CASCADE;

WITH legacy_conversations AS (
  INSERT INTO support_conversations (user_id)
  SELECT DISTINCT user_id
  FROM support_messages
  WHERE conversation_id IS NULL
  RETURNING id, user_id
)
UPDATE support_messages AS message
SET conversation_id = conversation.id
FROM legacy_conversations AS conversation
WHERE message.user_id = conversation.user_id
  AND message.conversation_id IS NULL;

ALTER TABLE support_messages
  ALTER COLUMN conversation_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_support_conversations_user_updated
  ON support_conversations(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_messages_user_created
  ON support_messages(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_support_messages_conversation_created
  ON support_messages(conversation_id, created_at);

CREATE OR REPLACE FUNCTION bump_support_conversation_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE support_conversations
  SET updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_message_updates_conversation ON support_messages;
CREATE TRIGGER support_message_updates_conversation
AFTER INSERT ON support_messages
FOR EACH ROW
EXECUTE FUNCTION bump_support_conversation_updated_at();
