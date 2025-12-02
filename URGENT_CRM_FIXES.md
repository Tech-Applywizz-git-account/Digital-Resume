# URGENT: CRM Frontend Integration - Quick Fix Guide

## ⚠️ CRITICAL ISSUE
The job requests, resumes, and recordings are NOT being saved to CRM tables/buckets because the frontend hasn't been updated yet.

## ✅ WHAT'S DONE:
1. ✅ Backend: CRM tables created
2. ✅ Backend: CRM storage buckets created  
3. ✅ Backend: sync-crm-users function working
4. ✅ Frontend: Dashboard updated
5. ✅ Frontend: Step1 updated
6. ✅ Frontend: Helper utilities created

## 🚧 WHAT NEEDS TO BE DONE:

### Files that MUST be updated:
1. **src/pages/Step2.tsx** - Resume upload
2. **src/pages/Record.tsx** - Video recording

---

## 📝 EXACT CODE CHANGES NEEDED:

### 1. Update src/pages/Step2.tsx

**Add this import at the top:**
```typescript
import { getUserInfo } from '../utils/crmHelpers';
```

**Replace the `handleSubmit` function (around line 80-175) with this:**

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!selectedFile) {
    showToast("Please select a resume file.", "warning");
    return;
  }
  if (!user) {
    showToast("Please sign in again before uploading.", "warning");
    return;
  }

  setIsUploading(true);
  try {
    const jobRequestId = localStorage.getItem("current_job_request_id");
    if (!jobRequestId) throw new Error("Missing job request ID (Step 1 not saved).");

    // Check if CRM user
    const isCRMUser = localStorage.getItem("is_crm_user") === "true";
    const crmEmail = localStorage.getItem("crm_user_email");

    const fileExt = selectedFile.name.split(".").pop()?.toLowerCase();
    const firstName =
      localStorage.getItem("first_name") ||
      (user && (user as any)?.user_metadata?.full_name?.split(" ")[0]) ||
      "user";

    const cleanFirstName = firstName.trim().replace(/\\s+/g, "_").toLowerCase();
    const timestamp = Date.now();
    const fileName = `${cleanFirstName}_careercast_resume_${timestamp}.${fileExt}`;

    let publicUrl: string | null = null;

    if (isCRMUser && crmEmail) {
      // CRM User - Upload to CRM bucket
      const filePath = `${crmEmail}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from("CRM_users_resumes")
        .upload(filePath, selectedFile, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage.from("CRM_users_resumes").getPublicUrl(filePath);
      publicUrl = publicData?.publicUrl ?? null;

      // Save to crm_resumes table
      await supabase.from("crm_resumes").insert({
        email: crmEmail,
        user_id: user.id,
        resume_name: fileName,
        resume_url: publicUrl,
        file_type: fileExt,
        file_size: selectedFile.size,
      });

      // Update crm_job_requests
      await supabase
        .from("crm_job_requests")
        .update({
          resume_url: publicUrl,
          application_status: "ready",
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobRequestId);
    } else {
      // Regular User - Upload to regular bucket
      const filePath = `${user.id}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from("resumes")
        .upload(filePath, selectedFile, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage.from("resumes").getPublicUrl(filePath);
      publicUrl = publicData?.publicUrl ?? null;

      // Update job_requests
      await supabase
        .from("job_requests")
        .update({
          resume_path: publicUrl,
          resume_original_name: fileName,
          status: "ready",
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobRequestId);
    }

    // Extract text (same for both)
    let extractedText = "";
    const buffer = await selectedFile.arrayBuffer();

    if (fileExt === "pdf") {
      try {
        const loadingTask = pdfjsLib.getDocument({ data: buffer });
        const pdf = await loadingTask.promise;
        let text = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const pageText = content.items.map((item: any) => item.str).join(" ");
          text += pageText + " ";
        }
        extractedText = text;
      } catch (pdfError: any) {
        console.error("❌ PDF processing failed:", pdfError.message);
        extractedText = "Text extraction failed.";
      }
    } else if (["docx", "doc"].includes(fileExt || "")) {
      const { value } = await mammoth.extractRawText({ arrayBuffer: buffer });
      extractedText = value;
    }

    extractedText = extractedText.replace(/\\s+/g, " ").trim().slice(0, 10000);

    // Save to localStorage
    localStorage.setItem("uploadedResumeUrl", publicUrl || "");
    localStorage.setItem("resumeFileName", fileName);
    localStorage.setItem("resumeFullText", extractedText);
    localStorage.removeItem("teleprompterText");

    showToast("Resume uploaded successfully!", "success");
    navigate("/step3");
  } catch (err: any) {
    console.error("❌ Upload failed:", err.message);
    showToast("Upload failed. Please try again.", "error");
  } finally {
    setIsUploading(false);
  }
};
```

---

### 2. Update src/pages/Record.tsx

Find the section where video is uploaded (search for `.from("recordings")`) and wrap it with CRM check:

```typescript
// Check if CRM user
const isCRMUser = localStorage.getItem("is_crm_user") === "true";
const crmEmail = localStorage.getItem("crm_user_email");

if (isCRMUser && crmEmail) {
  // Upload to CRM bucket
  const filePath = `${crmEmail}/${recordingId}.webm`;
  
  await supabase.storage
    .from("CRM_users_recordings")
    .upload(filePath, videoBlob);

  // Save to crm_recordings table
  await supabase.from("crm_recordings").insert({
    email: crmEmail,
    user_id: user.id,
    job_request_id: jobRequestId,
    video_url: filePath,
    duration: videoDuration,
    file_size: videoBlob.size,
    status: "completed",
  });
} else {
  // Regular user - existing code
  const filePath = `${user.id}/${recordingId}.webm`;
  
  await supabase.storage
    .from("recordings")
    .upload(filePath, videoBlob);

  await supabase.from("recordings").insert({
    user_id: user.id,
    job_request_id: jobRequestId,
    storage_path: filePath,
    // ... existing fields
  });
}
```

---

## 🎯 TESTING CHECKLIST:

After making these changes:

1. ✅ Login as CRM user (email from sync, password: Applywizz@123)
2. ✅ Create job request → Check `crm_job_requests` table
3. ✅ Upload resume → Check `CRM_users_resumes` bucket + `crm_resumes` table
4. ✅ Record video → Check `CRM_users_recordings` bucket + `crm_recordings` table
5. ✅ Verify credits decrease in `digital_resume_by_crm` table

---

## 📧 EMAIL INTEGRATION (Bonus):

I'll also add email sending to the sync-crm-users function using your MS365 credentials.

---

**DO YOU WANT ME TO:**
1. Try to fix Step2.tsx and Record.tsx files again (risky - might corrupt)?
2. OR just focus on adding email to the edge function?

Let me know!
