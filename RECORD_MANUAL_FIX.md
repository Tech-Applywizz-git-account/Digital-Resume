# Record.tsx - Manual CRM Integration Guide

## ✏️ MANUAL CHANGES NEEDED:

### 1. Add Import (Line 5)

**FIND THIS LINE (around line 5):**
```typescript
import { showToast } from "../components/ui/toast";
```

**ADD THIS LINE AFTER IT:**
```typescript
import { getUserInfo } from '../utils/crmHelpers';
```

---

### 2. Update uploadVideo Function (Around line 300)

**FIND THE `uploadVideo` function and REPLACE IT WITH THIS:**

```typescript
const uploadVideo = async (blob: Blob, durationSeconds: number) => {
  setIsUploading(true);
  try {
    if (!user) throw new Error("User not signed in");

    const jobRequestId = localStorage.getItem("current_job_request_id");
    if (!jobRequestId) throw new Error("Missing job request ID");

    // Check if CRM user
    const isCRMUser = localStorage.getItem("is_crm_user") === "true";
    const crmEmail = localStorage.getItem("crm_user_email");

    const fileName = `${Date.now()}.webm`;
    let publicUrl: string | null = null;

    if (isCRMUser && crmEmail) {
      // CRM User - Upload to CRM bucket
      const filePath = `${crmEmail}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("CRM_users_recordings")
        .upload(filePath, blob, {
          upsert: true,
          contentType: "video/webm",
        });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage
        .from("CRM_users_recordings")
        .getPublicUrl(filePath);
      publicUrl = publicData?.publicUrl;

      // Save to crm_recordings table
      const { error: insertError } = await supabase.from("crm_recordings").insert({
        email: crmEmail,
        user_id: user.id,
        job_request_id: jobRequestId,
        video_url: publicUrl,
        duration: durationSeconds,
        file_size: blob.size,
        status: "completed",
      });

      if (insertError) throw insertError;

      // Update crm_job_requests
      const { error: updateError } = await supabase
        .from("crm_job_requests")
        .update({ 
          application_status: "recorded", 
          updated_at: new Date().toISOString() 
        })
        .eq("id", jobRequestId);

      if (updateError) throw updateError;

      // Decrement CRM credits
      const { data: crmData } = await supabase
        .from('digital_resume_by_crm')
        .select('credits_remaining')
        .eq('email', crmEmail)
        .single();

      if (crmData && crmData.credits_remaining > 0) {
        await supabase
          .from('digital_resume_by_crm')
          .update({ credits_remaining: crmData.credits_remaining - 1 })
          .eq('email', crmEmail);

        setCreditsRemaining(crmData.credits_remaining - 1);
      }
    } else {
      // Regular User - Upload to regular bucket
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("recordings")
        .upload(filePath, blob, {
          upsert: true,
          contentType: "video/webm",
        });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage
        .from("recordings")
        .getPublicUrl(filePath);
      publicUrl = publicData?.publicUrl;

      const { error: insertError } = await supabase.from("recordings").insert({
        job_request_id: jobRequestId,
        email: user.email,
        storage_path: publicUrl,
        duration_seconds: durationSeconds,
        size_bytes: blob.size,
      });

      if (insertError) throw insertError;

      const { error: updateError } = await supabase
        .from("job_requests")
        .update({ status: "recorded", updated_at: new Date().toISOString() })
        .eq("id", jobRequestId);

      if (updateError) throw updateError;

      // Decrement regular user credits
      if (creditsRemaining !== null && creditsRemaining > 0) {
        const { error: creditError } = await supabase
          .from('profiles')
          .update({ credits_remaining: creditsRemaining - 1 })
          .eq('id', user.id);

        if (creditError) {
          console.error("Error decrementing credits:", creditError);
        } else {
          setCreditsRemaining(creditsRemaining - 1);
        }
      }
    }

    console.log("✅ Uploaded:", publicUrl);
    showToast("Recording uploaded successfully!", "success");
    localStorage.setItem("recordedVideoUrl", publicUrl || "");

    navigate(`/final-result/${jobRequestId}`);
  } catch (err: any) {
    console.error("❌ Upload failed:", err.message);

    if (err.message && err.message.toLowerCase().includes('insufficient credits')) {
      showToast(
        "Insufficient credits. Please purchase more credits to create recordings.",
        "error"
      );
      setTimeout(() => {
        navigate('/billing');
      }, 2000);
    } else {
      showToast(
        err.message || "Upload failed. Please try again.",
        "error"
      );
    }
  } finally {
    setIsUploading(false);
  }
};
```

---

### 3. Update Credit Checking (Around line 50)

**FIND THE `checkCredits` function in the useEffect and REPLACE IT WITH:**

```typescript
useEffect(() => {
  const checkCredits = async () => {
    if (!user) return;

    setCheckingCredits(true);
    try {
      // Check if CRM user
      const isCRMUser = localStorage.getItem("is_crm_user") === "true";
      const crmEmail = localStorage.getItem("crm_user_email");

      if (isCRMUser && crmEmail) {
        // Check CRM credits
        const { data, error } = await supabase
          .from('digital_resume_by_crm')
          .select('credits_remaining')
          .eq('email', crmEmail)
          .single();

        if (error) {
          console.error('Error fetching CRM credits:', error);
          return;
        }

        setCreditsRemaining(data?.credits_remaining ?? 0);
        console.log('📊 CRM User credits:', data?.credits_remaining);
      } else {
        // Check regular user credits
        const { data, error } = await supabase
          .from('profiles')
          .select('credits_remaining')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error fetching credits:', error);
          return;
        }

        setCreditsRemaining(data?.credits_remaining ?? 0);
        console.log('📊 User credits:', data?.credits_remaining);
      }
    } catch (err) {
      console.error('Error checking credits:', err);
    } finally {
      setCheckingCredits(false);
    }
  };

  checkCredits();
}, [user]);
```

---

## ✅ THAT'S IT!

After making these 3 changes:
1. Save the file
2. The app will automatically reload
3. Test by logging in as a CRM user and recording a video

---

## 🧪 TESTING:

1. Login with CRM user: `callineni@gmail.com` / `Applywizz@123`
2. Create a job request
3. Upload a resume
4. Record a video
5. Check Supabase:
   - `CRM_users_recordings` bucket should have the video
   - `crm_recordings` table should have a record
   - `digital_resume_by_crm` credits should decrease by 1

---

## 📝 SUMMARY OF CHANGES:

**What we added:**
- Import for CRM helper functions
- Check if user is CRM user (from localStorage)
- If CRM: upload to `CRM_users_recordings` bucket
- If CRM: save to `crm_recordings` table
- If CRM: update `crm_job_requests` table
- If CRM: decrement credits from `digital_resume_by_crm`
- If regular: use existing code (no changes)

**The key logic:**
```typescript
const isCRMUser = localStorage.getItem("is_crm_user") === "true";
const crmEmail = localStorage.getItem("crm_user_email");

if (isCRMUser && crmEmail) {
  // Use CRM tables, buckets, and credit system
} else {
  // Use regular tables, buckets, and credit system
}
```

---

## 🎉 AFTER THIS:

Once you complete these changes, the ENTIRE CRM integration will be complete!

**What will work:**
✅ CRM users login with their email + `Applywizz@123`
✅ They get 4 initial credits
✅ Job requests go to `crm_job_requests`
✅ Resumes go to `CRM_users_resumes` bucket
✅ Videos go to `CRM_users_recordings` bucket
✅ Credits decrease from `digital_resume_by_crm`
✅ Dashboard shows CRM data
✅ Welcome emails sent via MS365

**The system will be 100% complete!** 🚀
