-- =====================================================
-- FIX SCRIPT: Enforce 3 Credits Per Payment (Strict)
-- =====================================================

-- 1. Update the trigger function to be idempotent
-- This ensures that even if a payment is updated multiple times, credits are only granted ONCE.
-- We use a new column 'credits_granted' to track this.

ALTER TABLE public.payment_details 
ADD COLUMN IF NOT EXISTS credits_granted BOOLEAN DEFAULT FALSE;

CREATE OR REPLACE FUNCTION grant_credits_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  -- Only grant credits if:
  -- 1. Status is 'completed'
  -- 2. Credits haven't been granted yet for this payment
  IF NEW.status = 'completed' AND (NEW.credits_granted IS FALSE OR NEW.credits_granted IS NULL) THEN
    
    -- Add 3 credits to the user's profile
    UPDATE public.profiles
    SET 
      credits_remaining = credits_remaining + 3,
      updated_at = NOW()
    WHERE id = NEW.user_id;
    
    -- Mark this payment as having granted credits
    -- We must update the NEW row directly in a BEFORE trigger, 
    -- but since this is likely an AFTER trigger (based on previous code), 
    -- we need to issue an UPDATE if it's AFTER, or set NEW if it's BEFORE.
    -- Let's check the trigger definition below.
    
    -- Log the credit grant
    RAISE NOTICE 'Granted 3 credits to user % for payment %', NEW.user_id, NEW.id;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Re-create the trigger as a BEFORE UPDATE trigger to allow modifying NEW.credits_granted
-- This is cleaner than an AFTER trigger which would require a recursive UPDATE.

DROP TRIGGER IF EXISTS payment_completed_grant_credits ON public.payment_details;

-- We need a separate function for the BEFORE trigger to set the flag
CREATE OR REPLACE FUNCTION mark_credits_granted()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed' OR NEW.credits_granted IS FALSE) THEN
     -- We will handle the actual credit update in the AFTER trigger or here?
     -- Let's do it here to keep it atomic.
     
     IF (NEW.credits_granted IS FALSE OR NEW.credits_granted IS NULL) THEN
        UPDATE public.profiles
        SET 
          credits_remaining = credits_remaining + 3,
          updated_at = NOW()
        WHERE id = NEW.user_id;
        
        NEW.credits_granted := TRUE;
     END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the BEFORE trigger
CREATE TRIGGER payment_completed_grant_credits_before
BEFORE INSERT OR UPDATE ON public.payment_details
FOR EACH ROW
EXECUTE FUNCTION mark_credits_granted();

-- 3. Backfill the credits_granted flag for existing completed payments
UPDATE public.payment_details
SET credits_granted = TRUE
WHERE status = 'completed';

-- 4. Final Cleanup: Reset credits to correct value (Total Payments * 3 - Total Recordings)
WITH calculated_credits AS (
  SELECT 
    p.id as user_id,
    (
      COALESCE((
        SELECT COUNT(*) 
        FROM public.payment_details pd 
        WHERE pd.user_id = p.id AND pd.status = 'completed'
      ), 0) * 3
    ) 
    - 
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
SET credits_remaining = GREATEST(0, cc.correct_credits)
FROM calculated_credits cc
WHERE p.id = cc.user_id;
