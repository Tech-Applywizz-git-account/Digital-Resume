# CRM Separate Tables - Quick Summary

## What Changed?

CRM users now have **completely separate tables** for all their data, using `email` as the foreign key to link everything together.

## New Tables Created

### 1. **crm_job_requests**
- Stores job applications for CRM users
- Foreign Key: `email` → `digital_resume_by_CRM(email)`
- Replaces: `job_requests` table (for CRM users only)

### 2. **crm_recordings**
- Stores video recordings for CRM users
- Foreign Key: `email` → `digital_resume_by_CRM(email)`
- Links to: `crm_job_requests(id)`
- Replaces: `recordings` table (for CRM users only)

### 3. **crm_resumes**
- Stores resumes for CRM users
- Foreign Key: `email` → `digital_resume_by_CRM(email)`
- New table specifically for CRM users

### 4. **crm_dashboard_stats**
- Tracks statistics for CRM users
- Foreign Key: `email` → `digital_resume_by_CRM(email)`
- Auto-updates when CRM users create data

## Key Features

### ✅ Automatic Dashboard Stats
When CRM users create data, stats are automatically updated:
- Create job request → `total_applications++`
- Create recording → `total_recordings++`
- Upload resume → `total_resumes++`

### ✅ Credit System Still Works
- CRM recordings still consume 1 credit
- Same credit logic applies (4 initial, then 3 per payment)

### ✅ Complete Data Isolation
- CRM user data is completely separate from regular users
- Easy to query, report, and manage CRM users independently

### ✅ Row Level Security
- Users can only access their own data
- Service role has full access

## Files Created

1. **`supabase-functions/migrations/add_crm_separate_tables.sql`**
   - Complete migration for all CRM tables
   - Includes triggers, functions, RLS policies

2. **`supabase-functions/CRM_SEPARATE_TABLES_GUIDE.md`**
   - Comprehensive architecture guide
   - Usage examples and queries

## Files Modified

1. **`supabase-functions/sync-crm-users/index.ts`**
   - Now creates `crm_dashboard_stats` record when syncing users

## How to Use

### Frontend: Detect CRM User
```typescript
const { data: crmUser } = await supabase
  .from('digital_resume_by_CRM')
  .select('*')
  .eq('user_id', user.id)
  .single();

const isCRMUser = !!crmUser;
```

### Frontend: Fetch CRM User Data
```typescript
if (isCRMUser) {
  // Use CRM tables
  const { data } = await supabase
    .from('crm_job_requests')  // ← CRM table
    .select('*')
    .eq('email', user.email);
} else {
  // Use regular tables
  const { data } = await supabase
    .from('job_requests')  // ← Regular table
    .select('*')
    .eq('user_id', user.id);
}
```

### Frontend: Create CRM User Data
```typescript
// Create job request for CRM user
await supabase
  .from('crm_job_requests')
  .insert({
    email: user.email,
    user_id: user.id,
    job_title: 'Software Engineer',
    company_name: 'Tech Corp',
  });

// Create recording for CRM user
await supabase
  .from('crm_recordings')
  .insert({
    email: user.email,
    user_id: user.id,
    job_request_id: jobRequestId,
    video_url: videoUrl,
  });
```

## Deployment Steps

### 1. Run First Migration (if not already done)
```sql
-- Run: supabase-functions/migrations/add_digital_resume_crm_table.sql
```

### 2. Run Second Migration (NEW)
```sql
-- Run: supabase-functions/migrations/add_crm_separate_tables.sql
```

### 3. Deploy Updated Sync Function
```bash
supabase functions deploy sync-crm-users
```

### 4. Verify Tables Created
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_name LIKE 'crm_%';

-- Should return:
-- crm_job_requests
-- crm_recordings
-- crm_resumes
-- crm_dashboard_stats
```

### 5. Test CRM User Flow
1. Sync a CRM user
2. Login with the user
3. Create a job request in `crm_job_requests`
4. Create a recording in `crm_recordings`
5. Check `crm_dashboard_stats` - should show updated counts

## Database Schema Diagram

```
digital_resume_by_CRM (email PK)
    ↓
    ├── crm_job_requests (email FK)
    │       ↓
    │       └── crm_recordings (job_request_id FK)
    │
    ├── crm_resumes (email FK)
    │
    └── crm_dashboard_stats (email FK, UNIQUE)
```

## Data Flow Example

```
1. CRM User Login
   ↓
2. Check if user exists in digital_resume_by_CRM
   ↓
3. If yes → Use CRM tables (crm_*)
   If no → Use regular tables (job_requests, recordings, etc.)
   ↓
4. Create job request in crm_job_requests
   ↓
5. Trigger updates crm_dashboard_stats.total_applications
   ↓
6. Create recording in crm_recordings
   ↓
7. Trigger consumes 1 credit from profiles
   ↓
8. Trigger updates crm_dashboard_stats.total_recordings
```

## Important Notes

### ⚠️ Email as Foreign Key
All CRM tables use `email` as the foreign key to `digital_resume_by_CRM`. This ensures:
- Data integrity (can't create CRM data without CRM user)
- Easy querying (can fetch all user data by email)
- Cascade deletes (deleting CRM user deletes all their data)

### ⚠️ User ID Still Used
Even though `email` is the foreign key, we still store `user_id` for:
- RLS policies (auth.uid() checks)
- Linking to auth.users table
- Compatibility with existing code

### ⚠️ Frontend Changes Required
You'll need to update your frontend to:
1. Detect if user is CRM user
2. Use appropriate tables (crm_* vs regular)
3. Use email for queries instead of just user_id

## Migration Checklist

- [ ] Run `add_digital_resume_crm_table.sql` migration
- [ ] Run `add_crm_separate_tables.sql` migration
- [ ] Verify all tables created
- [ ] Verify all triggers created
- [ ] Deploy updated sync function
- [ ] Test CRM user creation
- [ ] Test CRM user login
- [ ] Test job request creation
- [ ] Test recording creation
- [ ] Test dashboard stats updates
- [ ] Update frontend to use CRM tables
- [ ] Test complete CRM user flow

## Next Steps

1. **Update Frontend Code:**
   - Add CRM user detection logic
   - Update all queries to use CRM tables for CRM users
   - Update all insert/update operations

2. **Test Thoroughly:**
   - Test CRM user creation
   - Test data insertion into CRM tables
   - Test dashboard stats updates
   - Test credit consumption

3. **Monitor:**
   - Check CRM table sizes
   - Monitor dashboard stats accuracy
   - Verify triggers are working

## Support

For detailed information, see:
- **Architecture Guide:** `supabase-functions/CRM_SEPARATE_TABLES_GUIDE.md`
- **Deployment Guide:** `supabase-functions/CRM_INTEGRATION_GUIDE.md`
- **Implementation Summary:** `IMPLEMENTATION_SUMMARY.md`
