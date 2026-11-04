-- Run in the Supabase SQL Editor for an existing Royal Spin database.
ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS withdrawal_fee DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payout_amount DECIMAL(15,2) NOT NULL DEFAULT 0;

-- Apply the fee only to withdrawals that are still awaiting manual payout.
UPDATE public.requests
SET withdrawal_fee = ROUND(amount * 0.05, 2),
    payout_amount = amount - ROUND(amount * 0.05, 2)
WHERE LOWER(type) = 'withdraw'
  AND LOWER(status) IN ('pending', 'processing')
  AND withdrawal_fee = 0
  AND payout_amount = 0;
