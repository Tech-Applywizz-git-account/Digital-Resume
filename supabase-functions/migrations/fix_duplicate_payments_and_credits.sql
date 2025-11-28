-- =====================================================
-- FIX SCRIPT: Deduplicate Payments & Recalculate Credits
-- =====================================================

-- 1. Remove duplicate payment records (keeping the earliest one)
-- This fixes the issue where a single PayPal transaction created multiple DB records
DELETE FROM public.payment_details a USING public.payment_details b
WHERE a.id > b.id 
AND a.paypal_order_id = b.paypal_order_id 
AND a.paypal_order_id IS NOT NULL;

-- 2. Enforce Unique Constraint on paypal_order_id
-- This prevents future duplicates
ALTER TABLE public.payment_details 
DROP CONSTRAINT IF EXISTS payment_details_paypal_order_id_key;

ALTER TABLE public.payment_details 
ADD CONSTRAINT payment_details_paypal_order_id_key UNIQUE (paypal_order_id);

-- 3. Recalculate credits for ALL users to ensure accuracy
-- Formula: (Total Completed Payments * 3) - (Total Recordings Created)
-- This will correct the "18 credits" issue back to 9 (assuming 3 payments)

WITH calculated_credits AS (
  SELECT 
    p.id as user_id,
    -- Credits from Payments: 3 per completed payment
    (
      COALESCE((
        SELECT COUNT(*) 
        FROM public.payment_details pd 
        WHERE pd.user_id = p.id AND pd.status = 'completed'
      ), 0) * 3
    ) 
    - 
    -- Credits Consumed: 1 per recording
    (
      COALESCE((
        SELECT COUNT(*) 
        FROM public.job_requests jr 
        JOIN public.recordings r ON r.job_request_id = jr.id
        WHERE jr.user_id = p.id
      ), 0)
    ) as correct_credits
  FROM public.profiles p
)
UPDATE public.profiles p
SET credits_remaining = GREATEST(0, cc.correct_credits) -- Ensure never negative
FROM calculated_credits cc
WHERE p.id = cc.user_id;

-- 4. Verify the fix
SELECT email, credits_remaining FROM public.profiles ORDER BY credits_remaining DESC;
