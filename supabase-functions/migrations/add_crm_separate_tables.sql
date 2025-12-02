-- Migration: Create Separate Tables for CRM Users
-- This migration creates dedicated tables for CRM users to store their data separately
-- All tables use email as foreign key to digital_resume_by_CRM table
-- NO RLS POLICIES - Direct access for all authenticated users

-- =====================================================
-- STEP 1: Storage Buckets (Create via Dashboard)
-- =====================================================

-- NOTE: Storage buckets must be created via Supabase Dashboard
-- Go to: Storage → Create new bucket
-- Create these two buckets:
-- 1. CRM_users_resumes (private)
-- 2. CRM_users_recordings (private)

-- We'll create them manually in the next step

-- =====================================================
-- STEP 2: Create CRM Job Requests Table
-- =====================================================

CREATE TABLE IF NOT EXISTS public.crm_job_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL REFERENCES public.digital_resume_by_CRM(email) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Job details
  job_title text,
  company_name text,
  job_description text,
  job_url text,
  
  -- Application details
  application_status text,
  applied_date timestamptz,
  
  -- Resume and cover letter
  resume_url text,
  cover_letter text,
  
  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT crm_job_requests_email_fkey FOREIGN KEY (email) REFERENCES public.digital_resume_by_CRM(email) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_crm_job_requests_email ON public.crm_job_requests(email);
CREATE INDEX IF NOT EXISTS idx_crm_job_requests_user_id ON public.crm_job_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_job_requests_created_at ON public.crm_job_requests(created_at DESC);

-- Comments
COMMENT ON TABLE public.crm_job_requests IS 'Job requests for CRM users - separate from regular job_requests table';
COMMENT ON COLUMN public.crm_job_requests.email IS 'Email from digital_resume_by_CRM table (foreign key)';

-- =====================================================
-- STEP 3: Create CRM Recordings Table
-- =====================================================

CREATE TABLE IF NOT EXISTS public.crm_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL REFERENCES public.digital_resume_by_CRM(email) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  job_request_id uuid REFERENCES public.crm_job_requests(id) ON DELETE CASCADE,
  
  -- Recording details (stored in CRM_users_recordings bucket)
  video_url text, -- Path in storage bucket: CRM_users_recordings/{email}/{recording_id}.webm
  thumbnail_url text,
  duration integer, -- in seconds
  file_size bigint, -- in bytes
  
  -- Recording metadata
  recording_date timestamptz,
  transcription text,
  
  -- Status
  status text DEFAULT 'processing', -- processing, completed, failed
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT crm_recordings_email_fkey FOREIGN KEY (email) REFERENCES public.digital_resume_by_CRM(email) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_crm_recordings_email ON public.crm_recordings(email);
CREATE INDEX IF NOT EXISTS idx_crm_recordings_user_id ON public.crm_recordings(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_recordings_job_request_id ON public.crm_recordings(job_request_id);
CREATE INDEX IF NOT EXISTS idx_crm_recordings_created_at ON public.crm_recordings(created_at DESC);

-- Comments
COMMENT ON TABLE public.crm_recordings IS 'Video recordings for CRM users - separate from regular recordings table. Videos stored in CRM_users_recordings bucket';
COMMENT ON COLUMN public.crm_recordings.email IS 'Email from digital_resume_by_CRM table (foreign key)';
COMMENT ON COLUMN public.crm_recordings.job_request_id IS 'Reference to crm_job_requests table';
COMMENT ON COLUMN public.crm_recordings.video_url IS 'Path to video in CRM_users_recordings storage bucket';

-- =====================================================
-- STEP 4: Create CRM Resumes Table
-- =====================================================

CREATE TABLE IF NOT EXISTS public.crm_resumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL REFERENCES public.digital_resume_by_CRM(email) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Resume details (stored in CRM_users_resumes bucket)
  resume_name text,
  resume_url text NOT NULL, -- Path in storage bucket: CRM_users_resumes/{email}/{resume_id}.pdf
  file_type text, -- pdf, docx, etc.
  file_size bigint, -- in bytes
  
  -- Parsed resume data
  parsed_data jsonb, -- Store parsed resume content
  
  -- Status
  is_primary boolean DEFAULT false, -- Is this the primary resume?
  is_active boolean DEFAULT true,
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT crm_resumes_email_fkey FOREIGN KEY (email) REFERENCES public.digital_resume_by_CRM(email) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_crm_resumes_email ON public.crm_resumes(email);
CREATE INDEX IF NOT EXISTS idx_crm_resumes_user_id ON public.crm_resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_resumes_is_primary ON public.crm_resumes(is_primary);
CREATE INDEX IF NOT EXISTS idx_crm_resumes_created_at ON public.crm_resumes(created_at DESC);

-- Comments
COMMENT ON TABLE public.crm_resumes IS 'Resumes for CRM users - separate from regular resumes table. Files stored in CRM_users_resumes bucket';
COMMENT ON COLUMN public.crm_resumes.email IS 'Email from digital_resume_by_CRM table (foreign key)';
COMMENT ON COLUMN public.crm_resumes.is_primary IS 'Whether this is the primary resume for the user';
COMMENT ON COLUMN public.crm_resumes.resume_url IS 'Path to resume file in CRM_users_resumes storage bucket';

-- =====================================================
-- STEP 5: Create CRM Dashboard Stats Table
-- =====================================================

CREATE TABLE IF NOT EXISTS public.crm_dashboard_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE REFERENCES public.digital_resume_by_CRM(email) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Statistics
  total_applications integer DEFAULT 0,
  total_recordings integer DEFAULT 0,
  total_resumes integer DEFAULT 0,
  total_views integer DEFAULT 0, -- How many times their recordings were viewed
  
  -- Activity tracking
  last_application_date timestamptz,
  last_recording_date timestamptz,
  last_login_date timestamptz,
  
  -- Engagement metrics
  total_time_spent integer DEFAULT 0, -- in seconds
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT crm_dashboard_stats_email_fkey FOREIGN KEY (email) REFERENCES public.digital_resume_by_CRM(email) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_crm_dashboard_stats_email ON public.crm_dashboard_stats(email);
CREATE INDEX IF NOT EXISTS idx_crm_dashboard_stats_user_id ON public.crm_dashboard_stats(user_id);

-- Comments
COMMENT ON TABLE public.crm_dashboard_stats IS 'Dashboard statistics for CRM users';
COMMENT ON COLUMN public.crm_dashboard_stats.email IS 'Email from digital_resume_by_CRM table (foreign key)';

-- =====================================================
-- STEP 6: Grant permissions (NO RLS - Direct Access)
-- =====================================================

-- Grant full access to authenticated users
GRANT ALL ON public.crm_job_requests TO authenticated;
GRANT ALL ON public.crm_recordings TO authenticated;
GRANT ALL ON public.crm_resumes TO authenticated;
GRANT ALL ON public.crm_dashboard_stats TO authenticated;

-- Grant full access to service role
GRANT ALL ON public.crm_job_requests TO service_role;
GRANT ALL ON public.crm_recordings TO service_role;
GRANT ALL ON public.crm_resumes TO service_role;
GRANT ALL ON public.crm_dashboard_stats TO service_role;

-- Grant access to anon role (for public access if needed)
GRANT SELECT ON public.crm_job_requests TO anon;
GRANT SELECT ON public.crm_recordings TO anon;
GRANT SELECT ON public.crm_resumes TO anon;
GRANT SELECT ON public.crm_dashboard_stats TO anon;

-- =====================================================
-- STEP 7: Create triggers to update dashboard stats
-- =====================================================

-- Function to update dashboard stats when job request is created
CREATE OR REPLACE FUNCTION update_crm_stats_on_job_request()
RETURNS TRIGGER AS $$
BEGIN
  -- Upsert dashboard stats
  INSERT INTO public.crm_dashboard_stats (email, user_id, total_applications, last_application_date)
  VALUES (NEW.email, NEW.user_id, 1, NEW.created_at)
  ON CONFLICT (email) DO UPDATE SET
    total_applications = crm_dashboard_stats.total_applications + 1,
    last_application_date = NEW.created_at,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update dashboard stats when recording is created
CREATE OR REPLACE FUNCTION update_crm_stats_on_recording()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.crm_dashboard_stats (email, user_id, total_recordings, last_recording_date)
  VALUES (NEW.email, NEW.user_id, 1, NEW.created_at)
  ON CONFLICT (email) DO UPDATE SET
    total_recordings = crm_dashboard_stats.total_recordings + 1,
    last_recording_date = NEW.created_at,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update dashboard stats when resume is created
CREATE OR REPLACE FUNCTION update_crm_stats_on_resume()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.crm_dashboard_stats (email, user_id, total_resumes)
  VALUES (NEW.email, NEW.user_id, 1)
  ON CONFLICT (email) DO UPDATE SET
    total_resumes = crm_dashboard_stats.total_resumes + 1,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
DROP TRIGGER IF EXISTS crm_job_request_stats_trigger ON public.crm_job_requests;
CREATE TRIGGER crm_job_request_stats_trigger
AFTER INSERT ON public.crm_job_requests
FOR EACH ROW
EXECUTE FUNCTION update_crm_stats_on_job_request();

DROP TRIGGER IF EXISTS crm_recording_stats_trigger ON public.crm_recordings;
CREATE TRIGGER crm_recording_stats_trigger
AFTER INSERT ON public.crm_recordings
FOR EACH ROW
EXECUTE FUNCTION update_crm_stats_on_recording();

DROP TRIGGER IF EXISTS crm_resume_stats_trigger ON public.crm_resumes;
CREATE TRIGGER crm_resume_stats_trigger
AFTER INSERT ON public.crm_resumes
FOR EACH ROW
EXECUTE FUNCTION update_crm_stats_on_resume();

-- =====================================================
-- STEP 8: Modify credit consumption trigger for CRM users
-- =====================================================

-- Update the consume_credit_on_recording function to work with CRM tables
CREATE OR REPLACE FUNCTION consume_credit_on_recording()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id uuid;
  v_credits integer;
  v_is_crm_user boolean;
  v_email text;
BEGIN
  -- Determine if this is a CRM recording or regular recording
  -- Check if the table is crm_recordings
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
  
  -- Get current credits for this user
  SELECT credits_remaining INTO v_credits
  FROM public.profiles
  WHERE id = v_user_id;
  
  -- Check if user has sufficient credits
  IF v_credits IS NULL OR v_credits <= 0 THEN
    RAISE EXCEPTION 'Insufficient credits. You need to purchase more credits to create a recording. Current credits: %', COALESCE(v_credits, 0)
      USING HINT = 'Please visit the billing page to purchase a credit pack.';
  END IF;
  
  -- Consume 1 credit
  UPDATE public.profiles
  SET 
    credits_remaining = credits_remaining - 1,
    updated_at = NOW()
  WHERE id = v_user_id;
  
  -- Log the credit consumption
  RAISE NOTICE 'Consumed 1 credit for user %. Remaining credits: %', v_user_id, v_credits - 1;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply trigger to CRM recordings table
DROP TRIGGER IF EXISTS crm_recording_consume_credit ON public.crm_recordings;
CREATE TRIGGER crm_recording_consume_credit
BEFORE INSERT ON public.crm_recordings
FOR EACH ROW
EXECUTE FUNCTION consume_credit_on_recording();

COMMENT ON TRIGGER crm_recording_consume_credit ON public.crm_recordings IS 
  'Consumes 1 credit when a CRM recording is created. Blocks creation if credits = 0.';

-- =====================================================
-- STEP 9: Create helper functions for CRM data
-- =====================================================

-- Function to get CRM user dashboard data
CREATE OR REPLACE FUNCTION get_crm_dashboard_data(p_email text)
RETURNS TABLE (
  total_applications integer,
  total_recordings integer,
  total_resumes integer,
  total_views integer,
  credits_remaining integer,
  last_application_date timestamptz,
  last_recording_date timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(ds.total_applications, 0) as total_applications,
    COALESCE(ds.total_recordings, 0) as total_recordings,
    COALESCE(ds.total_resumes, 0) as total_resumes,
    COALESCE(ds.total_views, 0) as total_views,
    COALESCE(crm.credits_remaining, 0) as credits_remaining,
    ds.last_application_date,
    ds.last_recording_date
  FROM public.digital_resume_by_CRM crm
  LEFT JOIN public.crm_dashboard_stats ds ON ds.email = crm.email
  WHERE crm.email = p_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_crm_dashboard_data(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_crm_dashboard_data(text) TO anon;

COMMENT ON FUNCTION get_crm_dashboard_data(text) IS 'Returns dashboard data for a CRM user by email';

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Run these queries after migration to verify:

-- 1. Check if all CRM tables exist
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_name IN ('crm_job_requests', 'crm_recordings', 'crm_resumes', 'crm_dashboard_stats');

-- 2. Check if storage buckets exist
-- SELECT id, name, public FROM storage.buckets 
-- WHERE name IN ('CRM_users_resumes', 'CRM_users_recordings');

-- 3. Check if all triggers exist
-- SELECT trigger_name, event_object_table FROM information_schema.triggers 
-- WHERE trigger_name LIKE 'crm_%';

-- 4. Check if all functions exist
-- SELECT routine_name FROM information_schema.routines 
-- WHERE routine_name LIKE '%crm%';

-- 5. Check foreign key constraints
-- SELECT
--   tc.table_name, 
--   kcu.column_name, 
--   ccu.table_name AS foreign_table_name,
--   ccu.column_name AS foreign_column_name 
-- FROM information_schema.table_constraints AS tc 
-- JOIN information_schema.key_column_usage AS kcu
--   ON tc.constraint_name = kcu.constraint_name
-- JOIN information_schema.constraint_column_usage AS ccu
--   ON ccu.constraint_name = tc.constraint_name
-- WHERE tc.constraint_type = 'FOREIGN KEY' 
--   AND tc.table_name LIKE 'crm_%';

-- =====================================================
-- STORAGE BUCKET USAGE EXAMPLES
-- =====================================================

-- Upload resume to CRM_users_resumes bucket:
-- Path format: {email}/{resume_id}.pdf
-- Example: user@example.com/123e4567-e89b-12d3-a456-426614174000.pdf

-- Upload recording to CRM_users_recordings bucket:
-- Path format: {email}/{recording_id}.webm
-- Example: user@example.com/123e4567-e89b-12d3-a456-426614174000.webm

-- Frontend upload example:
-- const { data, error } = await supabase.storage
--   .from('CRM_users_resumes')
--   .upload(`${user.email}/${resumeId}.pdf`, file);

-- Frontend download example:
-- const { data } = supabase.storage
--   .from('CRM_users_resumes')
--   .getPublicUrl(`${user.email}/${resumeId}.pdf`);
