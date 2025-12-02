# CRM Separate Tables - Architecture Guide

## Overview
CRM users have **completely separate tables** for their data to ensure data isolation and easier management. All CRM tables use `email` as a foreign key to the `digital_resume_by_CRM` table.

## Table Structure

### 1. **digital_resume_by_CRM** (Main CRM User Table)
- **Primary Key:** `email`
- **Purpose:** Main tracking table for CRM users
- **Columns:**
  - `email` (text, PRIMARY KEY)
  - `user_id` (uuid, FK to auth.users)
  - `credits_remaining` (integer, default 4)
  - `payment_details` (jsonb)
  - `user_created_at` (timestamptz)
  - `last_sync_at` (timestamptz)
  - `is_active` (boolean)

### 2. **crm_job_requests** (CRM User Job Applications)
- **Primary Key:** `id` (uuid)
- **Foreign Keys:** 
  - `email` → `digital_resume_by_CRM(email)`
  - `user_id` → `auth.users(id)`
- **Purpose:** Store job applications for CRM users
- **Columns:**
  - `id` (uuid, PRIMARY KEY)
  - `email` (text, FK)
  - `user_id` (uuid, FK)
  - `job_title` (text)
  - `company_name` (text)
  - `job_description` (text)
  - `job_url` (text)
  - `application_status` (text)
  - `applied_date` (timestamptz)
  - `resume_url` (text)
  - `cover_letter` (text)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

### 3. **crm_recordings** (CRM User Video Recordings)
- **Primary Key:** `id` (uuid)
- **Foreign Keys:**
  - `email` → `digital_resume_by_CRM(email)`
  - `user_id` → `auth.users(id)`
  - `job_request_id` → `crm_job_requests(id)`
- **Purpose:** Store video recordings for CRM users
- **Columns:**
  - `id` (uuid, PRIMARY KEY)
  - `email` (text, FK)
  - `user_id` (uuid, FK)
  - `job_request_id` (uuid, FK)
  - `video_url` (text)
  - `thumbnail_url` (text)
  - `duration` (integer, seconds)
  - `file_size` (bigint, bytes)
  - `recording_date` (timestamptz)
  - `transcription` (text)
  - `status` (text: processing/completed/failed)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

### 4. **crm_resumes** (CRM User Resumes)
- **Primary Key:** `id` (uuid)
- **Foreign Keys:**
  - `email` → `digital_resume_by_CRM(email)`
  - `user_id` → `auth.users(id)`
- **Purpose:** Store resumes for CRM users
- **Columns:**
  - `id` (uuid, PRIMARY KEY)
  - `email` (text, FK)
  - `user_id` (uuid, FK)
  - `resume_name` (text)
  - `resume_url` (text, NOT NULL)
  - `file_type` (text: pdf/docx/etc)
  - `file_size` (bigint, bytes)
  - `parsed_data` (jsonb)
  - `is_primary` (boolean, default false)
  - `is_active` (boolean, default true)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

### 5. **crm_dashboard_stats** (CRM User Dashboard Statistics)
- **Primary Key:** `id` (uuid)
- **Unique Key:** `email`
- **Foreign Keys:**
  - `email` → `digital_resume_by_CRM(email)`
  - `user_id` → `auth.users(id)`
- **Purpose:** Track dashboard statistics for CRM users
- **Columns:**
  - `id` (uuid, PRIMARY KEY)
  - `email` (text, UNIQUE, FK)
  - `user_id` (uuid, FK)
  - `total_applications` (integer, default 0)
  - `total_recordings` (integer, default 0)
  - `total_resumes` (integer, default 0)
  - `total_views` (integer, default 0)
  - `last_application_date` (timestamptz)
  - `last_recording_date` (timestamptz)
  - `last_login_date` (timestamptz)
  - `total_time_spent` (integer, seconds)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

## Data Flow

### CRM User Creation Flow
```
1. Sync function runs
   ↓
2. Creates user in auth.users
   ↓
3. Creates profile with 4 credits
   ↓
4. Creates record in digital_resume_by_CRM (email as PK)
   ↓
5. Creates record in crm_dashboard_stats
   ↓
6. User can now login and use CRM-specific tables
```

### Data Insertion Flow
```
CRM User creates job application
   ↓
Insert into crm_job_requests (with email FK)
   ↓
Trigger updates crm_dashboard_stats
   ↓
total_applications++, last_application_date updated
```

### Recording Creation Flow
```
CRM User creates recording
   ↓
Check credits in profiles table
   ↓
If credits > 0:
   ↓
   Insert into crm_recordings (with email FK)
   ↓
   Consume 1 credit from profiles
   ↓
   Trigger updates crm_dashboard_stats
   ↓
   total_recordings++, last_recording_date updated
```

## Comparison: Regular Users vs CRM Users

| Feature | Regular Users | CRM Users |
|---------|--------------|-----------|
| **Job Requests Table** | `job_requests` | `crm_job_requests` |
| **Recordings Table** | `recordings` | `crm_recordings` |
| **Resumes Table** | `resumes` (if exists) | `crm_resumes` |
| **Dashboard Stats** | N/A | `crm_dashboard_stats` |
| **Initial Credits** | 0 (must pay $12.99) | 4 (free from CRM) |
| **Credits per Payment** | 3 | 3 (after initial 4) |
| **Tracking Table** | N/A | `digital_resume_by_CRM` |
| **Foreign Key** | `user_id` | `email` + `user_id` |

## Automatic Triggers

### 1. Dashboard Stats Updates
When a CRM user creates data, their dashboard stats are automatically updated:

- **Job Request Created** → `total_applications++`, `last_application_date` updated
- **Recording Created** → `total_recordings++`, `last_recording_date` updated
- **Resume Uploaded** → `total_resumes++`

### 2. Credit Consumption
When a CRM user creates a recording:
- Check `profiles.credits_remaining`
- If > 0: Allow creation and consume 1 credit
- If = 0: Block creation with error message

### 3. Credit Sync
When credits change in `profiles` table:
- Automatically sync to `digital_resume_by_CRM.credits_remaining`

## Helper Functions

### get_crm_dashboard_data(email)
Returns complete dashboard data for a CRM user:

```sql
SELECT * FROM get_crm_dashboard_data('user@example.com');
```

Returns:
- `total_applications`
- `total_recordings`
- `total_resumes`
- `total_views`
- `credits_remaining`
- `last_application_date`
- `last_recording_date`

## Frontend Integration

### Detecting CRM Users
```typescript
// Check if user is from CRM
const { data: crmUser } = await supabase
  .from('digital_resume_by_CRM')
  .select('*')
  .eq('user_id', user.id)
  .single();

const isCRMUser = !!crmUser;
```

### Fetching CRM User Data
```typescript
// For CRM users
if (isCRMUser) {
  // Fetch job requests from CRM table
  const { data: jobRequests } = await supabase
    .from('crm_job_requests')
    .select('*')
    .eq('email', user.email)
    .order('created_at', { ascending: false });

  // Fetch recordings from CRM table
  const { data: recordings } = await supabase
    .from('crm_recordings')
    .select('*')
    .eq('email', user.email)
    .order('created_at', { ascending: false });

  // Fetch dashboard stats
  const { data: stats } = await supabase
    .rpc('get_crm_dashboard_data', { p_email: user.email });
}
```

### Creating CRM User Data
```typescript
// Create job request for CRM user
const { data, error } = await supabase
  .from('crm_job_requests')
  .insert({
    email: user.email,
    user_id: user.id,
    job_title: 'Software Engineer',
    company_name: 'Tech Corp',
    // ... other fields
  });

// Create recording for CRM user
const { data, error } = await supabase
  .from('crm_recordings')
  .insert({
    email: user.email,
    user_id: user.id,
    job_request_id: jobRequestId,
    video_url: videoUrl,
    // ... other fields
  });
```

## Row Level Security (RLS)

All CRM tables have RLS enabled with the following policies:

### User Policies
- Users can **SELECT** their own data (`auth.uid() = user_id`)
- Users can **INSERT** their own data (`auth.uid() = user_id`)
- Users can **UPDATE** their own data (`auth.uid() = user_id`)
- Users can **DELETE** their own data (`auth.uid() = user_id`)

### Service Role Policies
- Service role has **FULL ACCESS** to all CRM tables

## Indexes

All CRM tables have indexes on:
- `email` - For fast lookups by email
- `user_id` - For fast lookups by user ID
- `created_at` - For sorting by creation date

Additional indexes:
- `crm_recordings.job_request_id` - For fetching recordings by job
- `crm_resumes.is_primary` - For finding primary resume

## Migration Order

Run migrations in this order:

1. **`add_digital_resume_crm_table.sql`** - Creates main CRM tracking table and credit system
2. **`add_crm_separate_tables.sql`** - Creates separate data tables for CRM users

## Querying Examples

### Get all CRM users with their stats
```sql
SELECT 
  crm.email,
  crm.credits_remaining,
  crm.user_created_at,
  stats.total_applications,
  stats.total_recordings,
  stats.total_resumes
FROM digital_resume_by_CRM crm
LEFT JOIN crm_dashboard_stats stats ON stats.email = crm.email
WHERE crm.is_active = true
ORDER BY crm.user_created_at DESC;
```

### Get CRM user's complete data
```sql
-- User info
SELECT * FROM digital_resume_by_CRM WHERE email = 'user@example.com';

-- Job applications
SELECT * FROM crm_job_requests WHERE email = 'user@example.com';

-- Recordings
SELECT * FROM crm_recordings WHERE email = 'user@example.com';

-- Resumes
SELECT * FROM crm_resumes WHERE email = 'user@example.com';

-- Dashboard stats
SELECT * FROM crm_dashboard_stats WHERE email = 'user@example.com';
```

### Get CRM users who need more credits
```sql
SELECT 
  crm.email,
  crm.credits_remaining,
  stats.total_recordings,
  stats.last_recording_date
FROM digital_resume_by_CRM crm
LEFT JOIN crm_dashboard_stats stats ON stats.email = crm.email
WHERE crm.credits_remaining = 0
  AND stats.total_recordings > 0
ORDER BY stats.last_recording_date DESC;
```

## Data Isolation Benefits

1. **Clear Separation:** CRM users' data is completely separate from regular users
2. **Easy Reporting:** Can easily generate reports for CRM users only
3. **Data Privacy:** CRM user data can be managed independently
4. **Performance:** Separate tables mean faster queries for both user types
5. **Flexibility:** Can add CRM-specific fields without affecting regular users

## Backup & Export

### Export CRM User Data
```sql
-- Export all CRM user data
COPY (
  SELECT 
    crm.*,
    stats.total_applications,
    stats.total_recordings,
    stats.total_resumes
  FROM digital_resume_by_CRM crm
  LEFT JOIN crm_dashboard_stats stats ON stats.email = crm.email
) TO '/path/to/crm_users_export.csv' WITH CSV HEADER;
```

### Backup CRM Tables
```bash
# Backup all CRM tables
pg_dump -h your-host -U your-user -d your-db \
  -t digital_resume_by_CRM \
  -t crm_job_requests \
  -t crm_recordings \
  -t crm_resumes \
  -t crm_dashboard_stats \
  > crm_tables_backup.sql
```

## Monitoring

### Check table sizes
```sql
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE tablename LIKE 'crm_%'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Check record counts
```sql
SELECT 
  'digital_resume_by_CRM' as table_name,
  COUNT(*) as record_count
FROM digital_resume_by_CRM
UNION ALL
SELECT 'crm_job_requests', COUNT(*) FROM crm_job_requests
UNION ALL
SELECT 'crm_recordings', COUNT(*) FROM crm_recordings
UNION ALL
SELECT 'crm_resumes', COUNT(*) FROM crm_resumes
UNION ALL
SELECT 'crm_dashboard_stats', COUNT(*) FROM crm_dashboard_stats;
```

## Troubleshooting

### Issue: Foreign key constraint violation
**Cause:** Trying to insert data with email that doesn't exist in `digital_resume_by_CRM`
**Solution:** Ensure user exists in `digital_resume_by_CRM` before inserting into other CRM tables

### Issue: Dashboard stats not updating
**Cause:** Trigger might be disabled or function has error
**Solution:** Check trigger status:
```sql
SELECT * FROM pg_trigger WHERE tgname LIKE 'crm_%';
```

### Issue: Credits not being consumed
**Cause:** Trigger on `crm_recordings` might not be working
**Solution:** Verify trigger exists:
```sql
SELECT * FROM pg_trigger WHERE tgname = 'crm_recording_consume_credit';
```

## Future Enhancements

1. **Analytics Dashboard:** Build admin dashboard to view CRM user analytics
2. **Automated Reports:** Generate weekly/monthly reports for CRM users
3. **Data Archival:** Archive inactive CRM user data after X months
4. **Advanced Stats:** Track more metrics like conversion rates, engagement scores
5. **Export API:** Create API endpoint to export CRM user data
