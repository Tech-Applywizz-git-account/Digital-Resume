# CRM User - Quick Fix Guide

## Your Situation
- ✅ You're already in `digital_resume_by_crm` table (CRM user)
- ✅ CRM buckets exist (`CRM_users_resumes`, `CRM_users_recordings`)
- ❌ Getting "Bucket not found" error
- ❌ "No resume and video preview found" message

## Root Cause
The buckets likely have RLS (Row Level Security) enabled or aren't properly public.

## Quick Fix - 2 Steps

### Step 1: Run the Bucket Fix
1. **Open Supabase Dashboard** → SQL Editor
2. **Copy and run:** `fix_crm_bucket_access.sql`

This will:
- ✅ Make CRM buckets PUBLIC
- ✅ Disable RLS on storage
- ✅ Remove all storage policies (you don't need them)

### Step 2: Diagnose Your Data
1. **Run the diagnostic queries:** `DIAGNOSE_CRM_ISSUE.sql`
2. **Replace** `'YOUR_EMAIL@example.com'` with your actual email
3. **Check the results:**

#### What to look for:

**If resume_url is NULL:**
- The upload never succeeded
- Need to upload again

**If resume_url exists but is only a path (no 'http'):**
```
Example: user@example.com/resume-123.pdf
```
This means the public URL wasn't generated. The code should be generating full URLs.

**If resume_url exists and starts with 'http':**
```
Example: https://[project].supabase.co/storage/v1/object/public/...
```
This is correct! The issue is elsewhere.

## Most Likely Issue

Based on your code in `Step2.tsx`, line 128-130:
```typescript
const { data: publicData } = supabase.storage
  .from("CRM_users_resumes")
  .getPublicUrl(filePath);
publicUrl = publicData?.publicUrl ?? null;
```

The code is correctly getting the public URL. The issue is likely:

1. **Bucket not found** → Run `fix_crm_bucket_access.sql`
2. **Files not actually uploaded** → Check storage with diagnostic queries

## Quick Test

After running the fix, try this in SQL Editor:

```sql
-- Check if buckets are accessible (replace with your email)
SELECT 
  bucket_id,
  name,
  created_at
FROM storage.objects
WHERE bucket_id IN ('CRM_users_resumes', 'CRM_users_recordings')
AND name LIKE '%YOUR_EMAIL%'
ORDER BY created_at DESC;
```

**Expected: Should show your uploaded files**

## If Still Not Working

Run these checks:

### Check 1: Are buckets public?
```sql
SELECT id, name, public 
FROM storage.buckets 
WHERE id IN ('CRM_users_resumes', 'CRM_users_recordings');
```
Both should show `public = true`

### Check 2: What's in your job requests?
```sql
SELECT job_title, resume_url, application_status, created_at
FROM crm_job_requests
WHERE email = 'YOUR_EMAIL'
ORDER BY created_at DESC
LIMIT 3;
```

### Check 3: Any recordings?
```sql
SELECT video_url, status, created_at
FROM crm_recordings
WHERE email = 'YOUR_EMAIL'
ORDER BY created_at DESC
LIMIT 3;
```

## After the Fix

1. **Clear browser cache** (Ctrl + Shift + Delete)
2. **Clear local storage** (F12 → Application → Local Storage → Clear)
3. **Log out and log back in**
4. **Try creating a new Digital Resume:**
   - Step 1: Enter job details
   - Step 2: Upload resume
   - Step 3: Record video
5. **Check Dashboard** - resume and video should appear

## Summary

**Run:** `fix_crm_bucket_access.sql` → This makes buckets fully public

**Diagnose:** `DIAGNOSE_CRM_ISSUE.sql` → This shows what's in your database

**Test:** Upload a resume → Should work now

---
**Still having issues?** Share the output from the diagnostic queries and I can help further!
