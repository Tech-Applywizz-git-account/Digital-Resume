# CRM Storage Buckets - Usage Guide

## Overview
CRM users have dedicated storage buckets for their files:
- **`CRM_users_resumes`** - For resume files (PDF, DOCX, etc.)
- **`CRM_users_recordings`** - For video recordings (WebM, MP4, etc.)

## Bucket Structure

### File Path Format
All files are organized by user email:

```
CRM_users_resumes/
  └── user@example.com/
      ├── resume-id-1.pdf
      ├── resume-id-2.pdf
      └── resume-id-3.docx

CRM_users_recordings/
  └── user@example.com/
      ├── recording-id-1.webm
      ├── recording-id-2.mp4
      └── thumbnail-id-1.jpg
```

## Frontend Usage

### 1. Upload Resume

```typescript
// Upload resume file
const uploadResume = async (file: File, email: string) => {
  const resumeId = crypto.randomUUID();
  const fileExt = file.name.split('.').pop();
  const filePath = `${email}/${resumeId}.${fileExt}`;

  // Upload to storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('CRM_users_resumes')
    .upload(filePath, file);

  if (uploadError) {
    console.error('Upload error:', uploadError);
    return null;
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('CRM_users_resumes')
    .getPublicUrl(filePath);

  // Save to database
  const { data, error } = await supabase
    .from('crm_resumes')
    .insert({
      email: email,
      user_id: user.id,
      resume_name: file.name,
      resume_url: filePath, // Store the path, not the full URL
      file_type: fileExt,
      file_size: file.size,
      is_primary: false,
    });

  return { data, url: urlData.publicUrl };
};
```

### 2. Upload Recording

```typescript
// Upload video recording
const uploadRecording = async (
  videoBlob: Blob,
  email: string,
  jobRequestId: string
) => {
  const recordingId = crypto.randomUUID();
  const filePath = `${email}/${recordingId}.webm`;

  // Upload video to storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('CRM_users_recordings')
    .upload(filePath, videoBlob, {
      contentType: 'video/webm',
    });

  if (uploadError) {
    console.error('Upload error:', uploadError);
    return null;
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('CRM_users_recordings')
    .getPublicUrl(filePath);

  // Save to database
  const { data, error } = await supabase
    .from('crm_recordings')
    .insert({
      email: email,
      user_id: user.id,
      job_request_id: jobRequestId,
      video_url: filePath, // Store the path
      duration: 0, // Calculate from video
      file_size: videoBlob.size,
      status: 'completed',
    });

  return { data, url: urlData.publicUrl };
};
```

### 3. Upload Thumbnail

```typescript
// Upload thumbnail for recording
const uploadThumbnail = async (
  thumbnailBlob: Blob,
  email: string,
  recordingId: string
) => {
  const filePath = `${email}/thumbnail-${recordingId}.jpg`;

  const { data, error } = await supabase.storage
    .from('CRM_users_recordings')
    .upload(filePath, thumbnailBlob, {
      contentType: 'image/jpeg',
    });

  if (error) {
    console.error('Thumbnail upload error:', error);
    return null;
  }

  // Update recording with thumbnail URL
  await supabase
    .from('crm_recordings')
    .update({ thumbnail_url: filePath })
    .eq('id', recordingId);

  return filePath;
};
```

### 4. Download/View Files

```typescript
// Get resume URL for viewing/downloading
const getResumeUrl = async (resumePath: string) => {
  const { data } = supabase.storage
    .from('CRM_users_resumes')
    .getPublicUrl(resumePath);

  return data.publicUrl;
};

// Get recording URL for playback
const getRecordingUrl = async (recordingPath: string) => {
  const { data } = supabase.storage
    .from('CRM_users_recordings')
    .getPublicUrl(recordingPath);

  return data.publicUrl;
};

// Download resume
const downloadResume = async (resumePath: string, fileName: string) => {
  const { data, error } = await supabase.storage
    .from('CRM_users_resumes')
    .download(resumePath);

  if (error) {
    console.error('Download error:', error);
    return;
  }

  // Create download link
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
};
```

### 5. Delete Files

```typescript
// Delete resume
const deleteResume = async (resumePath: string, resumeId: string) => {
  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from('CRM_users_resumes')
    .remove([resumePath]);

  if (storageError) {
    console.error('Storage delete error:', storageError);
    return;
  }

  // Delete from database
  const { error: dbError } = await supabase
    .from('crm_resumes')
    .delete()
    .eq('id', resumeId);

  if (dbError) {
    console.error('Database delete error:', dbError);
  }
};

// Delete recording
const deleteRecording = async (recordingPath: string, recordingId: string) => {
  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from('CRM_users_recordings')
    .remove([recordingPath]);

  if (storageError) {
    console.error('Storage delete error:', storageError);
    return;
  }

  // Delete from database
  const { error: dbError } = await supabase
    .from('crm_recordings')
    .delete()
    .eq('id', recordingId);

  if (dbError) {
    console.error('Database delete error:', dbError);
  }
};
```

### 6. List User Files

```typescript
// List all resumes for a user
const listUserResumes = async (email: string) => {
  const { data, error } = await supabase.storage
    .from('CRM_users_resumes')
    .list(email);

  if (error) {
    console.error('List error:', error);
    return [];
  }

  return data;
};

// List all recordings for a user
const listUserRecordings = async (email: string) => {
  const { data, error } = await supabase.storage
    .from('CRM_users_recordings')
    .list(email);

  if (error) {
    console.error('List error:', error);
    return [];
  }

  return data;
};
```

## React Component Examples

### Resume Upload Component

```tsx
import { useState } from 'react';
import { supabase } from './supabaseClient';

export function ResumeUpload({ userEmail, userId }) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      const resumeId = crypto.randomUUID();
      const fileExt = file.name.split('.').pop();
      const filePath = `${userEmail}/${resumeId}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('CRM_users_resumes')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Save to database
      const { error: dbError } = await supabase
        .from('crm_resumes')
        .insert({
          email: userEmail,
          user_id: userId,
          resume_name: file.name,
          resume_url: filePath,
          file_type: fileExt,
          file_size: file.size,
        });

      if (dbError) throw dbError;

      alert('Resume uploaded successfully!');
    } catch (error) {
      console.error('Error:', error);
      alert('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept=".pdf,.doc,.docx"
        onChange={handleUpload}
        disabled={uploading}
      />
      {uploading && <p>Uploading...</p>}
    </div>
  );
}
```

### Recording Display Component

```tsx
import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export function RecordingPlayer({ recordingPath }) {
  const [videoUrl, setVideoUrl] = useState('');

  useEffect(() => {
    const { data } = supabase.storage
      .from('CRM_users_recordings')
      .getPublicUrl(recordingPath);

    setVideoUrl(data.publicUrl);
  }, [recordingPath]);

  return (
    <video controls src={videoUrl} className="w-full">
      Your browser does not support video playback.
    </video>
  );
}
```

## Storage Policies (No RLS)

The buckets have **NO RLS policies** - all authenticated users have direct access. This means:

✅ **Advantages:**
- Simpler implementation
- No policy debugging needed
- Faster access

⚠️ **Security Considerations:**
- Users can technically access other users' files if they know the path
- Implement application-level security checks
- Consider adding RLS policies later if needed

## File Size Limits

Default Supabase limits:
- **Free tier:** 1GB total storage
- **Pro tier:** 100GB total storage
- **Max file size:** 50MB per file (can be increased)

To increase file size limit:
```sql
-- Increase max file size to 100MB
UPDATE storage.buckets
SET file_size_limit = 104857600
WHERE id IN ('CRM_users_resumes', 'CRM_users_recordings');
```

## Best Practices

### 1. File Naming
```typescript
// Use UUIDs for unique file names
const fileName = `${crypto.randomUUID()}.${fileExtension}`;

// Organize by user email
const filePath = `${userEmail}/${fileName}`;
```

### 2. Error Handling
```typescript
try {
  const { data, error } = await supabase.storage
    .from('CRM_users_resumes')
    .upload(filePath, file);

  if (error) throw error;
  
  // Success handling
} catch (error) {
  if (error.message.includes('Duplicate')) {
    // Handle duplicate file
  } else if (error.message.includes('size')) {
    // Handle file too large
  } else {
    // Handle other errors
  }
}
```

### 3. Progress Tracking
```typescript
const uploadWithProgress = async (file: File) => {
  const xhr = new XMLHttpRequest();
  
  xhr.upload.addEventListener('progress', (e) => {
    const percent = (e.loaded / e.total) * 100;
    console.log(`Upload progress: ${percent}%`);
  });

  // Use Supabase storage upload with progress
  // Note: Supabase JS client doesn't support progress natively
  // Consider using direct HTTP upload for progress tracking
};
```

### 4. Cleanup on Delete
```typescript
// Always delete from both storage and database
const deleteResumeCompletely = async (resumeId: string) => {
  // Get resume info
  const { data: resume } = await supabase
    .from('crm_resumes')
    .select('resume_url')
    .eq('id', resumeId)
    .single();

  if (resume) {
    // Delete from storage
    await supabase.storage
      .from('CRM_users_resumes')
      .remove([resume.resume_url]);

    // Delete from database
    await supabase
      .from('crm_resumes')
      .delete()
      .eq('id', resumeId);
  }
};
```

## Troubleshooting

### Issue: Upload fails with "Bucket not found"
**Solution:** Ensure migration was run and buckets were created:
```sql
SELECT * FROM storage.buckets 
WHERE name IN ('CRM_users_resumes', 'CRM_users_recordings');
```

### Issue: Cannot access uploaded files
**Solution:** Check if file path is stored correctly in database:
```sql
SELECT resume_url FROM crm_resumes WHERE email = 'user@example.com';
-- Should return: user@example.com/uuid.pdf
```

### Issue: File too large error
**Solution:** Check bucket file size limit:
```sql
SELECT file_size_limit FROM storage.buckets 
WHERE id = 'CRM_users_resumes';
```

## Monitoring

### Check storage usage
```sql
-- Get total storage used per bucket
SELECT 
  bucket_id,
  COUNT(*) as file_count,
  SUM(metadata->>'size')::bigint as total_bytes,
  pg_size_pretty(SUM(metadata->>'size')::bigint) as total_size
FROM storage.objects
WHERE bucket_id IN ('CRM_users_resumes', 'CRM_users_recordings')
GROUP BY bucket_id;
```

### Check user storage usage
```sql
-- Get storage used by specific user
SELECT 
  bucket_id,
  COUNT(*) as file_count,
  pg_size_pretty(SUM(metadata->>'size')::bigint) as total_size
FROM storage.objects
WHERE name LIKE 'user@example.com/%'
GROUP BY bucket_id;
```

## Summary

✅ **Two dedicated buckets for CRM users**
✅ **Files organized by user email**
✅ **No RLS policies - direct access**
✅ **Simple upload/download API**
✅ **Automatic cleanup on user deletion (CASCADE)**

For more information, see the main migration file: `add_crm_separate_tables.sql`
