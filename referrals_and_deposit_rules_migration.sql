-- Run in the Supabase SQL Editor for an existing Royal Spin database.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by);

ALTER TABLE game_config
  ALTER COLUMN welcome_bonus SET DEFAULT 0,
  ALTER COLUMN wager_requirement SET DEFAULT 2;

UPDATE game_config
SET welcome_bonus = 0,
    wager_requirement = 2,
    updated_at = NOW()
WHERE id = 1;

CREATE OR REPLACE FUNCTION public.get_referrer_id(referral_code UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT id FROM public.users WHERE id = referral_code AND is_admin = FALSE
$$;

GRANT EXECUTE ON FUNCTION public.get_referrer_id(UUID) TO anon, authenticated;
