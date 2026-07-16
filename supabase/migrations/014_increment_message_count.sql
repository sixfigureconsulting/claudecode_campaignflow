-- Migration 014: Atomic message count increment for inbox conversations
-- Replaces the read-modify-write pattern in sync routes with a single atomic UPDATE.
-- The `mark_unread` param controls whether to flip is_read to false (use false for outbound).

CREATE OR REPLACE FUNCTION increment_message_count(
  conversation_id UUID,
  mark_unread     BOOLEAN DEFAULT true
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE inbox_conversations
  SET
    message_count = message_count + 1,
    is_read       = CASE WHEN mark_unread THEN false ELSE is_read END,
    updated_at    = NOW()
  WHERE id = conversation_id;
$$;
