-- Fix CRM Triggers and RLS
-- 1. Disable RLS on all CRM tables to ensure access
-- 2. Fix credit consumption trigger to check digital_resume_by_crm table

-- =====================================================
-- 1. Ensure RLS is DISABLED
-- =====================================================
ALTER TABLE public.crm_job_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_recordings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_resumes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_dashboard_stats DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- 2. Fix Credit Consumption Trigger
-- =====================================================

CREATE OR REPLACE FUNCTION consume_credit_on_recording()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id uuid;
  v_credits integer;
  v_is_crm_user boolean;
  v_email text;
BEGIN
  -- Determine if this is a CRM recording or regular recording
  IF TG_TABLE_NAME = 'crm_recordings' THEN
    v_user_id := NEW.user_id;
    v_email := NEW.email;
    v_is_crm_user := true;
  ELSE
    -- Regular recording - get user_id from job_request
    SELECT user_id INTO v_user_id
    FROM public.job_requests
    WHERE id = NEW.job_request_id;
    
    v_is_crm_user := false;
  END IF;
  
  -- If we couldn't find the user_id, raise an error
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Cannot create recording: user not found';
  END IF;
  
  -- CHECK CREDITS BASED ON USER TYPE
  IF v_is_crm_user THEN
    -- CRM User: Check digital_resume_by_crm
    SELECT credits_remaining INTO v_credits
    FROM public.digital_resume_by_crm
    WHERE email = v_email;
  ELSE
    -- Regular User: Check profiles
    SELECT credits_remaining INTO v_credits
    FROM public.profiles
    WHERE id = v_user_id;
  END IF;
  
  -- Check if user has sufficient credits
  IF v_credits IS NULL OR v_credits <= 0 THEN
    RAISE EXCEPTION 'Insufficient credits. You need to purchase more credits to create a recording. Current credits: %', COALESCE(v_credits, 0)
      USING HINT = 'Please visit the billing page to purchase a credit pack.';
  END IF;
  
  -- CONSUME CREDIT BASED ON USER TYPE
  IF v_is_crm_user THEN
    -- CRM User: Update digital_resume_by_crm
    UPDATE public.digital_resume_by_crm
    SET 
      credits_remaining = credits_remaining - 1,
      last_sync_at = NOW()
    WHERE email = v_email;
  ELSE
    -- Regular User: Update profiles
    UPDATE public.profiles
    SET 
      credits_remaining = credits_remaining - 1,
      updated_at = NOW()
    WHERE id = v_user_id;
  END IF;
  
  -- Log the credit consumption
  RAISE NOTICE 'Consumed 1 credit for user %. Remaining credits: %', v_user_id, v_credits - 1;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create the trigger to be sure
DROP TRIGGER IF EXISTS crm_recording_consume_credit ON public.crm_recordings;
CREATE TRIGGER crm_recording_consume_credit
BEFORE INSERT ON public.crm_recordings
FOR EACH ROW
EXECUTE FUNCTION consume_credit_on_recording();
