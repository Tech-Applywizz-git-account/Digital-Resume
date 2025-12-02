-- Migration: Add Digital Resume CRM Integration
-- This migration creates a new table to track users sourced from CRM
-- and modifies the credit system to support 4 credits for CRM users

-- =====================================================
-- STEP 1: Create digital_resume_by_CRM table
-- =====================================================

CREATE TABLE IF NOT EXISTS public.digital_resume_by_CRM (
  email text PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  credits_remaining integer NOT NULL DEFAULT 4,
  payment_details jsonb,
  user_created_at timestamptz NOT NULL DEFAULT now(),
  last_sync_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT unique_user_id UNIQUE (user_id)
);

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_digital_resume_crm_user_id ON public.digital_resume_by_CRM(user_id);
CREATE INDEX IF NOT EXISTS idx_digital_resume_crm_email ON public.digital_resume_by_CRM(email);
CREATE INDEX IF NOT EXISTS idx_digital_resume_crm_active ON public.digital_resume_by_CRM(is_active);

-- Add comments
COMMENT ON TABLE public.digital_resume_by_CRM IS 'Tracks users created from CRM sales_closure table with digital_sale_resume > 0';
COMMENT ON COLUMN public.digital_resume_by_CRM.email IS 'User email from CRM';
COMMENT ON COLUMN public.digital_resume_by_CRM.user_id IS 'Reference to auth.users';
COMMENT ON COLUMN public.digital_resume_by_CRM.credits_remaining IS 'Number of credits remaining (starts at 4 for CRM users)';
COMMENT ON COLUMN public.digital_resume_by_CRM.payment_details IS 'JSON object containing payment and CRM metadata';
COMMENT ON COLUMN public.digital_resume_by_CRM.user_created_at IS 'Timestamp when user was created in our system';
COMMENT ON COLUMN public.digital_resume_by_CRM.last_sync_at IS 'Last time this record was synced from CRM';

-- =====================================================
-- STEP 2: Grant permissions (NO RLS - Direct Access)
-- =====================================================

-- Grant full access to authenticated users
GRANT ALL ON public.digital_resume_by_CRM TO authenticated;

-- Grant full access to service role
GRANT ALL ON public.digital_resume_by_CRM TO service_role;

-- Grant access to anon role (for public access if needed)
GRANT SELECT ON public.digital_resume_by_CRM TO anon;

-- =====================================================
-- STEP 3: Create helper function to check if user is from CRM
-- =====================================================

CREATE OR REPLACE FUNCTION is_crm_user(p_user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.digital_resume_by_CRM
    WHERE user_id = p_user_id AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_crm_user(uuid) IS 'Returns true if the user was created from CRM';

GRANT EXECUTE ON FUNCTION is_crm_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION is_crm_user(uuid) TO service_role;

-- =====================================================
-- STEP 4: Modify grant_credits_on_payment to support CRM users
-- =====================================================

-- Drop existing trigger first
DROP TRIGGER IF EXISTS payment_completed_grant_credits ON public.payment_details;

-- Create updated function that grants 4 credits for CRM users initially, then 3
CREATE OR REPLACE FUNCTION grant_credits_on_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_is_crm_user boolean;
  v_credits_to_grant integer;
  v_payment_count integer;
BEGIN
  -- Only grant credits when payment status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    -- Check if user is from CRM
    v_is_crm_user := is_crm_user(NEW.user_id);
    
    IF v_is_crm_user THEN
      -- For CRM users: count previous completed payments
      SELECT COUNT(*) INTO v_payment_count
      FROM public.payment_details
      WHERE user_id = NEW.user_id 
        AND status = 'completed'
        AND id != NEW.id;
      
      -- First payment for CRM user gets 4 credits, subsequent get 3
      IF v_payment_count = 0 THEN
        v_credits_to_grant := 4;
      ELSE
        v_credits_to_grant := 3;
      END IF;
    ELSE
      -- Regular users always get 3 credits
      v_credits_to_grant := 3;
    END IF;
    
    -- Add credits to the user's profile
    UPDATE public.profiles
    SET 
      credits_remaining = credits_remaining + v_credits_to_grant,
      updated_at = NOW()
    WHERE id = NEW.user_id;
    
    -- Also update the CRM table if applicable
    IF v_is_crm_user THEN
      UPDATE public.digital_resume_by_CRM
      SET 
        credits_remaining = (SELECT credits_remaining FROM public.profiles WHERE id = NEW.user_id),
        last_sync_at = NOW()
      WHERE user_id = NEW.user_id;
    END IF;
    
    RAISE NOTICE 'Granted % credits to user % (CRM: %) for payment %', 
      v_credits_to_grant, NEW.user_id, v_is_crm_user, NEW.id;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER payment_completed_grant_credits
AFTER UPDATE ON public.payment_details
FOR EACH ROW
EXECUTE FUNCTION grant_credits_on_payment();

COMMENT ON TRIGGER payment_completed_grant_credits ON public.payment_details IS 
  'Grants 4 credits for first CRM user payment, 3 for subsequent payments. Regular users always get 3 credits.';

-- =====================================================
-- STEP 5: Create trigger to sync credits when recording is consumed
-- =====================================================

-- Function to sync CRM table when credits change
CREATE OR REPLACE FUNCTION sync_crm_credits_on_profile_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Only sync if credits_remaining changed
  IF NEW.credits_remaining != OLD.credits_remaining THEN
    UPDATE public.digital_resume_by_CRM
    SET 
      credits_remaining = NEW.credits_remaining,
      last_sync_at = NOW()
    WHERE user_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on profiles table
DROP TRIGGER IF EXISTS sync_crm_credits ON public.profiles;

CREATE TRIGGER sync_crm_credits
AFTER UPDATE ON public.profiles
FOR EACH ROW
WHEN (OLD.credits_remaining IS DISTINCT FROM NEW.credits_remaining)
EXECUTE FUNCTION sync_crm_credits_on_profile_update();

COMMENT ON TRIGGER sync_crm_credits ON public.profiles IS 
  'Syncs credit changes from profiles table to digital_resume_by_CRM table';

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Run these queries after migration to verify:

-- 1. Check if table exists
-- SELECT table_name, table_type 
-- FROM information_schema.tables 
-- WHERE table_name = 'digital_resume_by_CRM';

-- 2. Check if functions exist
-- SELECT routine_name, routine_type 
-- FROM information_schema.routines 
-- WHERE routine_name IN ('is_crm_user', 'grant_credits_on_payment', 'sync_crm_credits_on_profile_update');

-- 3. Check if triggers exist
-- SELECT trigger_name, event_manipulation, event_object_table 
-- FROM information_schema.triggers 
-- WHERE trigger_name IN ('payment_completed_grant_credits', 'sync_crm_credits');
