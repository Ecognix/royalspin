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

ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.support_conversations TO authenticated;
GRANT SELECT, INSERT ON public.support_messages TO authenticated;

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND is_admin = TRUE
  )
$$;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated;

DROP POLICY IF EXISTS "Users can read own support conversations" ON public.support_conversations;
CREATE POLICY "Users can read own support conversations"
  ON public.support_conversations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own support conversations" ON public.support_conversations;
CREATE POLICY "Users can create own support conversations"
  ON public.support_conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can read all support conversations" ON public.support_conversations;
CREATE POLICY "Admins can read all support conversations"
  ON public.support_conversations FOR SELECT TO authenticated
  USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "Users can read own support messages" ON public.support_messages;
CREATE POLICY "Users can read own support messages"
  ON public.support_messages FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can read all support messages" ON public.support_messages;
CREATE POLICY "Admins can read all support messages"
  ON public.support_messages FOR SELECT TO authenticated
  USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "Users can send own support messages" ON public.support_messages;
CREATE POLICY "Users can send own support messages"
  ON public.support_messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND sender_role = 'user'
    AND EXISTS (
      SELECT 1 FROM public.support_conversations
      WHERE id = conversation_id AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can send support replies" ON public.support_messages;
CREATE POLICY "Admins can send support replies"
  ON public.support_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_role = 'admin'
    AND public.is_current_user_admin()
    AND EXISTS (
      SELECT 1 FROM public.support_conversations
      WHERE id = conversation_id AND user_id = public.support_messages.user_id
    )
  );

CREATE OR REPLACE FUNCTION public.bump_support_conversation_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.support_conversations
  SET updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_message_updates_conversation ON public.support_messages;
CREATE TRIGGER support_message_updates_conversation
AFTER INSERT ON public.support_messages
FOR EACH ROW
EXECUTE FUNCTION public.bump_support_conversation_updated_at();
