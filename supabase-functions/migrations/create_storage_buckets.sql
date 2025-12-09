-- ========================================
-- Storage Buckets Setup - Regular Users Only
-- ========================================
-- This migration creates the storage buckets for REGULAR users only.
-- CRM buckets (CRM_users_resumes, CRM_users_recordings) already exist.

-- NOTE: If you see "duplicate key value" errors, that's OK - it means the buckets already exist.

-- Create bucket for regular user resumes
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resumes',
  'resumes',
  true, -- Public access
  10485760, -- 10MB limit
  ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- Create bucket for regular user video recordings
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'recordings',
  'recordings',
  true, -- Public access
  104857600, -- 100MB limit
  ARRAY['video/webm', 'video/mp4', 'video/quicktime']
)
ON CONFLICT (id) DO NOTHING;

-- ========================================
-- Storage Policies for Regular Users
-- ========================================

-- Allow authenticated users to upload to resumes bucket
CREATE POLICY IF NOT EXISTS "Allow authenticated users to upload resumes"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'resumes');

-- Allow authenticated users to read from resumes bucket
CREATE POLICY IF NOT EXISTS "Allow authenticated users to read resumes"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'resumes');

-- Allow users to update their own resumes
CREATE POLICY IF NOT EXISTS "Allow users to update own resumes"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow users to delete their own resumes
CREATE POLICY IF NOT EXISTS "Allow users to delete own resumes"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to upload to recordings bucket
CREATE POLICY IF NOT EXISTS "Allow authenticated users to upload recordings"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'recordings');

-- Allow authenticated users to read from recordings bucket
CREATE POLICY IF NOT EXISTS "Allow authenticated users to read recordings"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'recordings');

-- Allow users to update their own recordings
CREATE POLICY IF NOT EXISTS "Allow users to update own recordings"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'recordings' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow users to delete their own recordings
CREATE POLICY IF NOT EXISTS "Allow users to delete own recordings"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'recordings' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ========================================
-- Verify Buckets Created
-- ========================================
DO $$
BEGIN
  RAISE NOTICE 'Storage buckets created successfully:';
  RAISE NOTICE '- resumes (for regular users)';
  RAISE NOTICE '- recordings (for regular users)';
  RAISE NOTICE 'Note: CRM buckets already exist';
END $$;
