# Step2.tsx - Manual CRM Integration Guide

## ✏️ MANUAL CHANGES NEEDED:

### 1. Add Import (Line 11)

**FIND THIS LINE (line 11):**
```typescript
import { showToast } from "../components/ui/toast";
```

**REPLACE WITH:**
```typescript
import { showToast } from "../components/ui/toast";
import { getUserInfo } from '../utils/crmHelpers';
```

---

### 2. Replace handleSubmit Function (Lines 80-175)

**FIND THE ENTIRE `handleSubmit` function starting at line 80**

**REPLACE THE ENTIRE FUNCTION WITH THIS:**

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

## ✅ THAT'S IT!

After making these 2 changes:
1. Save the file
2. The app will automatically reload
3. Test by logging in as a CRM user and uploading a resume

---

## 🧪 TESTING:

1. Login with CRM user: `callineni@gmail.com` / `Applywizz@123`
2. Create a job request
3. Upload a resume
4. Check Supabase:
   - `CRM_users_resumes` bucket should have the file
   - `crm_resumes` table should have a record
   - `crm_job_requests` should be updated with resume_url

---

## 📝 SUMMARY OF CHANGES:

**What we added:**
- Import for CRM helper functions
- Check if user is CRM user (from localStorage)
- If CRM: upload to `CRM_users_resumes` bucket
- If CRM: save to `crm_resumes` table
- If CRM: update `crm_job_requests` table
- If regular: use existing code (no changes)

**The key logic:**
```typescript
const isCRMUser = localStorage.getItem("is_crm_user") === "true";
const crmEmail = localStorage.getItem("crm_user_email");

if (isCRMUser && crmEmail) {
  // Use CRM tables and buckets
} else {
  // Use regular tables and buckets
}
```

This same pattern will be used for Record.tsx!
