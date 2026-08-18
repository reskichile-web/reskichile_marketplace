
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS must_change_password boolean DEFAULT false;

-- Mark all existing users as needing password change (the imported ones)
UPDATE public.users SET must_change_password = true;
;
