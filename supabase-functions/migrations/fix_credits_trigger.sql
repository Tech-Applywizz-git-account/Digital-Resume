-- Fix trigger to handle INSERT as well as UPDATE for payment_details
-- This ensures credits are granted even if the payment is inserted with status='completed'

CREATE OR REPLACE FUNCTION grant_credits_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if status is 'completed'
  -- For INSERT: Just check if NEW.status is 'completed'
  -- For UPDATE: Check if NEW.status is 'completed' AND OLD.status was NOT 'completed'
  
  IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    -- Add 3 credits to the user's profile
    UPDATE public.profiles
    SET 
      credits_remaining = credits_remaining + 3,
      updated_at = NOW()
    WHERE id = NEW.user_id;
    
    -- Log the credit grant
    RAISE NOTICE 'Granted 3 credits to user % for payment % (Operation: %)', NEW.user_id, NEW.id, TG_OP;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old trigger
DROP TRIGGER IF EXISTS payment_completed_grant_credits ON public.payment_details;

-- Create new trigger for both INSERT and UPDATE
CREATE TRIGGER payment_completed_grant_credits
AFTER INSERT OR UPDATE ON public.payment_details
FOR EACH ROW
EXECUTE FUNCTION grant_credits_on_payment();
