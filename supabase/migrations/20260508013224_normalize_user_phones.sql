-- Backfill: normalize every users.phone to the canonical "+<country><local>"
-- shape. Chilean-specific heuristics:
--   "+56XXXXXXXXX"  → unchanged (canonical)
--   "56XXXXXXXXX"   → "+56XXXXXXXXX"
--   "9XXXXXXXX"     → "+569XXXXXXXX"  (assume Chile mobile)
--   anything else   → leave NULL (refuse to guess)

UPDATE public.users
SET phone = '+' || phone
WHERE phone ~ '^56[0-9]{9}$';

UPDATE public.users
SET phone = '+56' || phone
WHERE phone ~ '^9[0-9]{8}$';

-- Empty strings → NULL so the CHECK constraint isn't violated and queries
-- can rely on `phone IS NOT NULL` meaning "we have a usable phone".
UPDATE public.users
SET phone = NULL
WHERE phone IS NOT NULL AND phone = '';

-- Lock the format going forward. Everything stored from now must match the
-- canonical shape; clients that try to write raw "9XXXXXXXX" will fail loud.
ALTER TABLE public.users
  ADD CONSTRAINT users_phone_canonical_format
  CHECK (phone IS NULL OR phone ~ '^\+[0-9]{8,15}$');
;
