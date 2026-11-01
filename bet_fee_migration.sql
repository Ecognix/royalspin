-- Run in the Supabase SQL Editor for an existing Royal Spin database.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS bet_fee_progress DECIMAL(5,2) NOT NULL DEFAULT 0;
