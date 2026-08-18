-- Per-user email notification preferences. Both default TRUE so existing
-- users keep getting messages until they explicitly opt out. The publish
-- form now exposes these toggles alongside the existing hide_phone flag.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS notify_chat_email BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_reminders_email BOOLEAN NOT NULL DEFAULT TRUE;
;
