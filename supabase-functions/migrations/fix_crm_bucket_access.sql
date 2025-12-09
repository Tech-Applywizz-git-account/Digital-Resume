-- ========================================
-- Simple CRM Bucket Fix - NO POLICIES
-- ========================================
-- This ensures CRM buckets are PUBLIC and accessible
-- WITHOUT any Row Level Security policies

-- ========================================
-- STEP 1: Make CRM buckets PUBLIC
-- ========================================

UPDATE storage.buckets 
SET public = true 
WHERE id IN ('CRM_users_resumes', 'CRM_users_recordings');

-- ========================================
-- STEP 2: Disable RLS on storage.objects (if enabled)
-- ========================================

ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;

-- ========================================
-- STEP 3: Drop ALL existing policies on storage.objects
-- ========================================

DO $$ 
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
    RAISE NOTICE 'Dropped policy: %', r.policyname;
  END LOOP;
END $$;

-- ========================================
-- STEP 4: Verify configuration
-- ========================================

-- Check buckets are public
SELECT 
  id,
  name,
  public,
  CASE 
    WHEN public = true THEN '✓ Public'
    ELSE '✗ Private'
  END as access_level,
  file_size_limit / 1024 / 1024 as size_limit_mb
FROM storage.buckets 
WHERE id IN ('CRM_users_resumes', 'CRM_users_recordings');

-- Check RLS is disabled
SELECT 
  tablename,
  rowsecurity,
  CASE 
    WHEN rowsecurity = false THEN '✓ RLS Disabled (No policies needed)'
    ELSE '✗ RLS Enabled (Policies required)'
  END as status
FROM pg_tables
WHERE schemaname = 'storage' 
AND tablename = 'objects';

-- Check no policies exist
SELECT 
  COUNT(*) as policy_count,
  CASE 
    WHEN COUNT(*) = 0 THEN '✓ No policies (fully public)'
    ELSE '⚠ Policies exist'
  END as status
FROM pg_policies
WHERE schemaname = 'storage'
AND tablename = 'objects';

-- Success message
DO $$ 
BEGIN
  RAISE NOTICE '════════════════════════════════════════';
  RAISE NOTICE '✓ CRM buckets configured as PUBLIC';
  RAISE NOTICE '✓ No RLS policies required';
  RAISE NOTICE '✓ Files are fully accessible';
  RAISE NOTICE '════════════════════════════════════════';
END $$;
