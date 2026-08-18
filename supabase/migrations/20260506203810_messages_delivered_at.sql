ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS messages_delivered_idx ON public.messages(conversation_id) WHERE delivered_at IS NULL;;
