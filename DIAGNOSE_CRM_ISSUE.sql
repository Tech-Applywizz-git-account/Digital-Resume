-- ========================================
-- Diagnostic Queries for CRM User Issues
-- ========================================
-- Run these queries to diagnose the "no resume and video preview found" issue

-- ========================================
-- STEP 1: Check your CRM user account
-- ========================================

-- Replace 'YOUR_EMAIL@example.com' with your actual email
SELECT 
  email,
  user_id,
  credits_remaining,
  is_active,
  user_created_at,
  last_sync_at
FROM digital_resume_by_crm
WHERE email = 'YOUR_EMAIL@example.com';

-- Expected: Should return 1 row with your details

-- ========================================
-- STEP 2: Check your job requests
-- ========================================

SELECT 
  id,
  job_title,
  resume_url,
  application_status,
  created_at,
  LENGTH(resume_url) as url_length,  -- Check if URL exists
  CASE 
    WHEN resume_url IS NULL THEN '❌ No resume uploaded'
    WHEN resume_url = '' THEN '❌ Empty resume URL'
    WHEN resume_url LIKE 'http%' THEN '✓ Valid URL format'
    ELSE '⚠️ Invalid URL format'
  END as resume_status
FROM crm_job_requests
WHERE email = 'YOUR_EMAIL@example.com'
ORDER BY created_at DESC
LIMIT 5;

-- Expected: Should show your job requests with resume URLs

-- ========================================
-- STEP 3: Check your recordings
-- ========================================

SELECT 
  r.id,
  r.job_request_id,
  r.video_url,
  r.status,
  r.duration,
  r.file_size,
  r.created_at,
  j.job_title,
  CASE 
    WHEN r.video_url IS NULL THEN '❌ No video uploaded'
    WHEN r.video_url = '' THEN '❌ Empty video URL'
    WHEN r.video_url LIKE 'http%' THEN '✓ Valid URL format'
    ELSE '⚠️ Invalid URL format (likely just path)'
  END as video_status
FROM crm_recordings r
LEFT JOIN crm_job_requests j ON j.id = r.job_request_id
WHERE r.email = 'YOUR_EMAIL@example.com'
ORDER BY r.created_at DESC
LIMIT 5;

-- Expected: Should show your recordings with video URLs

-- ========================================
-- STEP 4: Check storage bucket contents
-- ========================================

-- Check resumes in storage
SELECT 
  name as file_path,
  bucket_id,
  metadata->>'size' as file_size,
  created_at
FROM storage.objects
WHERE bucket_id = 'CRM_users_resumes'
AND name LIKE 'YOUR_EMAIL@example.com%'
ORDER BY created_at DESC
LIMIT 10;

-- Check recordings in storage
SELECT 
  name as file_path,
  bucket_id,
  metadata->>'size' as file_size,
  created_at
FROM storage.objects
WHERE bucket_id = 'CRM_users_recordings'
AND name LIKE 'YOUR_EMAIL@example.com%'
ORDER BY created_at DESC
LIMIT 10;

-- ========================================
-- STEP 5: Check bucket permissions
-- ========================================

SELECT 
  id,
  name,
  public,
  file_size_limit / 1024 / 1024 as size_limit_mb,
  allowed_mime_types
FROM storage.buckets
WHERE id IN ('CRM_users_resumes', 'CRM_users_recordings');

-- ========================================
-- STEP 6: Check storage policies
-- ========================================

SELECT 
  policyname,
  cmd as operation,
  roles,
  qual as using_expression
FROM pg_policies
WHERE schemaname = 'storage'
AND tablename = 'objects'
AND (
  policyname LIKE '%CRM%' 
  OR policyname LIKE '%crm%'
)
ORDER BY policyname;

-- ========================================
-- COMMON ISSUES AND FIXES
-- ========================================

-- Issue 1: resume_url or video_url is NULL
-- → The upload failed, files didn't save properly
-- Fix: Try uploading again after running fix_crm_bucket_access.sql

-- Issue 2: resume_url is just a path (no 'http')
-- → The app saved the path instead of the public URL
-- Fix: We need to regenerate the public URLs

-- Issue 3: No files in storage.objects
-- → Files were never uploaded to storage
-- Fix: Clear browser cache, log out/in, try again

-- Issue 4: Buckets are not public
-- → Files exist but can't be accessed
-- Fix: Run fix_crm_bucket_access.sql

-- ========================================
-- FIX: Regenerate public URLs (if needed)
-- ========================================

-- If resume_url contains paths like 'email/file.pdf' instead of full URLs,
-- we can regenerate them. First, check:

SELECT 
  id,
  job_title,
  resume_url,
  CASE 
    WHEN resume_url LIKE 'http%' THEN 'OK'
    ELSE 'NEEDS FIX'
  END as status
FROM crm_job_requests
WHERE email = 'YOUR_EMAIL@example.com'
AND resume_url IS NOT NULL;

-- If any show 'NEEDS FIX', you'll need to re-upload the resume
-- or we can create a function to regenerate the URLs

-- ========================================
-- SUMMARY DIAGNOSTIC
-- ========================================

-- Run this to get a complete summary
SELECT 
  'Total Job Requests' as metric,
  COUNT(*)::text as value
FROM crm_job_requests
WHERE email = 'YOUR_EMAIL@example.com'

UNION ALL

SELECT 
  'Requests with Resume',
  COUNT(*)::text
FROM crm_job_requests
WHERE email = 'YOUR_EMAIL@example.com'
AND resume_url IS NOT NULL

UNION ALL

SELECT 
  'Total Recordings',
  COUNT(*)::text
FROM crm_recordings
WHERE email = 'YOUR_EMAIL@example.com'

UNION ALL

SELECT 
  'Files in Resume Bucket',
  COUNT(*)::text
FROM storage.objects
WHERE bucket_id = 'CRM_users_resumes'
AND name LIKE 'YOUR_EMAIL@example.com%'

UNION ALL

SELECT 
  'Files in Recording Bucket',
  COUNT(*)::text
FROM storage.objects
WHERE bucket_id = 'CRM_users_recordings'
AND name LIKE 'YOUR_EMAIL@example.com%';
