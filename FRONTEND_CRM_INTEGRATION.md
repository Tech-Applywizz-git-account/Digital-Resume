# Frontend Integration Guide - CRM User Support

## Overview
This guide explains how to update the frontend to support CRM users by routing their data to separate CRM tables and storage buckets.

---

## Step 1: Create CRM Helper Utilities

Create a new file: `src/utils/crmHelpers.ts`

```typescript
import { supabase } from '../integrations/supabase/client';

/**
 * Check if the current user is a CRM user
 */
export const isCRMUser = async (userId: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('digital_resume_by_crm')
    .select('email')
    .eq('user_id', userId)
    .single();

  return !!data && !error;
};

/**
 * Get CRM user email
 */
export const getCRMUserEmail = async (userId: string): Promise<string | null> => {
  const { data } = await supabase
    .from('digital_resume_by_crm')
    .select('email')
    .eq('user_id', userId)
    .single();

  return data?.email || null;
};

/**
 * Get user type and email
 */
export const getUserInfo = async (userId: string) => {
  const isCRM = await isCRMUser(userId);
  const email = isCRM ? await getCRMUserEmail(userId) : null;
  
  return {
    isCRMUser: isCRM,
    email: email,
  };
};
```

---

## Step 2: Update Dashboard to Show CRM Stats

Update `src/pages/Dashboard.tsx`:

### Add imports at the top:
```typescript
import { isCRMUser, getCRMUserEmail } from '../utils/crmHelpers';
```

### Add state for CRM user:
```typescript
const [isCRM, setIsCRM] = useState(false);
const [crmEmail, setCRMEmail] = useState<string | null>(null);
```

### Check if user is CRM on load:
```typescript
useEffect(() => {
  const checkCRMUser = async () => {
    if (user?.id) {
      const isCRMUser = await isCRMUser(user.id);
      setIsCRM(isCRMUser);
      
      if (isCRMUser) {
        const email = await getCRMUserEmail(user.id);
        setCRMEmail(email);
      }
    }
  };
  
  checkCRMUser();
}, [user]);
```

### Update data fetching to use CRM tables:
```typescript
const fetchDashboardData = async () => {
  if (!user) return;

  if (isCRM && crmEmail) {
    // Fetch from CRM tables
    const { data: stats } = await supabase
      .from('crm_dashboard_stats')
      .select('*')
      .eq('email', crmEmail)
      .single();

    const { data: jobRequests } = await supabase
      .from('crm_job_requests')
      .select('*')
      .eq('email', crmEmail);

    const { data: recordings } = await supabase
      .from('crm_recordings')
      .select('*')
      .eq('email', crmEmail);

    // Update state with CRM data
    setDashboardStats(stats);
    setJobRequests(jobRequests);
    setRecordings(recordings);
  } else {
    // Fetch from regular tables (existing code)
    // ... your existing fetch logic
  }
};
```

---

## Step 3: Update Job Request Creation (Step1, Step2, Step3)

Update `src/pages/Step1.tsx`, `Step2.tsx`, `Step3.tsx`:

### Add imports:
```typescript
import { getUserInfo } from '../utils/crmHelpers';
```

### When saving job request:
```typescript
const saveJobRequest = async (jobData) => {
  const { isCRMUser, email } = await getUserInfo(user.id);

  if (isCRMUser && email) {
    // Save to CRM table
    const { data, error } = await supabase
      .from('crm_job_requests')
      .insert({
        email: email,
        user_id: user.id,
        job_title: jobData.jobTitle,
        company_name: jobData.companyName,
        job_description: jobData.jobDescription,
        job_url: jobData.jobUrl,
        // ... other fields
      });
  } else {
    // Save to regular table (existing code)
    const { data, error } = await supabase
      .from('job_requests')
      .insert({
        user_id: user.id,
        // ... existing fields
      });
  }
};
```

---

## Step 4: Update Recording Upload (Record.tsx)

Update `src/pages/Record.tsx`:

### Add imports:
```typescript
import { getUserInfo } from '../utils/crmHelpers';
```

### When uploading recording:
```typescript
const uploadRecording = async (videoBlob: Blob, jobRequestId: string) => {
  const { isCRMUser, email } = await getUserInfo(user.id);
  
  const recordingId = crypto.randomUUID();

  if (isCRMUser && email) {
    // Upload to CRM bucket
    const filePath = `${email}/${recordingId}.webm`;
    
    const { error: uploadError } = await supabase.storage
      .from('CRM_users_recordings')
      .upload(filePath, videoBlob, {
        contentType: 'video/webm',
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return;
    }

    // Save to CRM recordings table
    const { error: dbError } = await supabase
      .from('crm_recordings')
      .insert({
        email: email,
        user_id: user.id,
        job_request_id: jobRequestId,
        video_url: filePath,
        duration: 0, // Calculate from video
        file_size: videoBlob.size,
        status: 'completed',
      });

    if (dbError) {
      console.error('Database error:', dbError);
    }
  } else {
    // Upload to regular bucket (existing code)
    const filePath = `${user.id}/${recordingId}.webm`;
    
    const { error: uploadError } = await supabase.storage
      .from('recordings')
      .upload(filePath, videoBlob);

    // Save to regular recordings table
    const { error: dbError } = await supabase
      .from('recordings')
      .insert({
        user_id: user.id,
        job_request_id: jobRequestId,
        video_url: filePath,
        // ... existing fields
      });
  }
};
```

---

## Step 5: Update Resume Upload

If you have resume upload functionality, update it similarly:

```typescript
const uploadResume = async (file: File) => {
  const { isCRMUser, email } = await getUserInfo(user.id);
  
  const resumeId = crypto.randomUUID();
  const fileExt = file.name.split('.').pop();

  if (isCRMUser && email) {
    // Upload to CRM bucket
    const filePath = `${email}/${resumeId}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('CRM_users_resumes')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return;
    }

    // Save to CRM resumes table
    const { error: dbError } = await supabase
      .from('crm_resumes')
      .insert({
        email: email,
        user_id: user.id,
        resume_name: file.name,
        resume_url: filePath,
        file_type: fileExt,
        file_size: file.size,
      });

    if (dbError) {
      console.error('Database error:', dbError);
    }
  } else {
    // Upload to regular bucket (existing code)
    // ... your existing upload logic
  }
};
```

---

## Step 6: Update Data Fetching Everywhere

For any component that fetches user data, add the CRM check:

```typescript
const fetchUserData = async () => {
  const { isCRMUser, email } = await getUserInfo(user.id);

  if (isCRMUser && email) {
    // Fetch from CRM tables
    const { data } = await supabase
      .from('crm_job_requests') // or crm_recordings, crm_resumes
      .select('*')
      .eq('email', email);
    
    return data;
  } else {
    // Fetch from regular tables
    const { data } = await supabase
      .from('job_requests') // or recordings, resumes
      .select('*')
      .eq('user_id', user.id);
    
    return data;
  }
};
```

---

## Summary of Changes Needed

### Files to Create:
1. ✅ `src/utils/crmHelpers.ts` - Helper functions

### Files to Update:
1. ✅ `src/pages/Dashboard.tsx` - Show CRM stats
2. ✅ `src/pages/Step1.tsx` - Save job requests to CRM table
3. ✅ `src/pages/Step2.tsx` - Save job requests to CRM table
4. ✅ `src/pages/Step3.tsx` - Save job requests to CRM table
5. ✅ `src/pages/Record.tsx` - Upload recordings to CRM bucket/table
6. ✅ Any resume upload component - Upload to CRM bucket/table

### Pattern to Follow:
```typescript
// 1. Check if CRM user
const { isCRMUser, email } = await getUserInfo(user.id);

// 2. Use CRM tables/buckets if CRM user
if (isCRMUser && email) {
  // Use: crm_job_requests, crm_recordings, crm_resumes
  // Use: CRM_users_recordings, CRM_users_resumes
} else {
  // Use regular tables/buckets
}
```

---

## Testing Checklist

After making changes:

1. ✅ Login as CRM user (password: Applywizz@123)
2. ✅ Create a job request → Check `crm_job_requests` table
3. ✅ Record a video → Check `crm_recordings` table and `CRM_users_recordings` bucket
4. ✅ Upload resume → Check `crm_resumes` table and `CRM_users_resumes` bucket
5. ✅ Check dashboard → Should show CRM stats
6. ✅ Verify credits decrease after recording

---

## Need Help?

This is a significant frontend update. Would you like me to:
1. Create the helper file for you?
2. Update specific components one by one?
3. Show you exactly where to make changes in each file?

Let me know which approach you prefer!
