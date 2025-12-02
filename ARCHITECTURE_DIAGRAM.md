# Digital Resume CRM Integration - Complete Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     EXTERNAL CRM DATABASE                            │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  sales_closure table                                          │  │
│  │  - email                                                      │  │
│  │  - digital_sale_resume (> 0 = eligible for sync)             │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ Sync Function
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                     YOUR SUPABASE DATABASE                           │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  auth.users                                                   │  │
│  │  - id (uuid)                                                  │  │
│  │  - email                                                      │  │
│  │  - encrypted_password (Applywizz@123)                        │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                              ↓                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  profiles                                                     │  │
│  │  - id (uuid, FK to auth.users)                               │  │
│  │  - email                                                      │  │
│  │  - credits_remaining (4 for CRM users)                       │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                              ↓                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  digital_resume_by_CRM (CRM TRACKING TABLE)                  │  │
│  │  - email (PRIMARY KEY)                                        │  │
│  │  - user_id (FK to auth.users)                                │  │
│  │  - credits_remaining (synced from profiles)                  │  │
│  │  - payment_details (jsonb)                                   │  │
│  │  - user_created_at                                           │  │
│  │  - is_active                                                 │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                              │ email (FK)                            │
│         ┌────────────────────┼────────────────────┐                 │
│         │                    │                    │                 │
│         ↓                    ↓                    ↓                 │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────┐         │
│  │crm_job_      │  │crm_recordings    │  │crm_resumes   │         │
│  │requests      │  │                  │  │              │         │
│  │              │  │                  │  │              │         │
│  │- email (FK)  │  │- email (FK)      │  │- email (FK)  │         │
│  │- user_id     │  │- user_id         │  │- user_id     │         │
│  │- job_title   │  │- job_request_id  │  │- resume_url  │         │
│  │- company     │  │- video_url       │  │- file_type   │         │
│  │              │  │- duration        │  │              │         │
│  └──────────────┘  └──────────────────┘  └──────────────┘         │
│         │                    │                    │                 │
│         └────────────────────┼────────────────────┘                 │
│                              │                                       │
│                              ↓                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  crm_dashboard_stats                                         │  │
│  │  - email (UNIQUE, FK)                                        │  │
│  │  - user_id                                                   │  │
│  │  - total_applications (auto-updated)                        │  │
│  │  - total_recordings (auto-updated)                          │  │
│  │  - total_resumes (auto-updated)                             │  │
│  │  - last_application_date                                    │  │
│  │  - last_recording_date                                      │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## User Flow Comparison

### Regular User Flow
```
1. User signs up manually
   ↓
2. Creates account in auth.users
   ↓
3. Profile created with 0 credits
   ↓
4. Must pay $12.99 for first 3 credits
   ↓
5. Data stored in:
   - job_requests
   - recordings
   - (regular tables)
```

### CRM User Flow
```
1. User exists in CRM database (digital_sale_resume > 0)
   ↓
2. Sync function creates account
   ↓
3. Profile created with 4 credits (FREE)
   ↓
4. Record created in digital_resume_by_CRM
   ↓
5. Dashboard stats record created
   ↓
6. User receives email with login credentials
   ↓
7. Data stored in:
   - crm_job_requests
   - crm_recordings
   - crm_resumes
   - crm_dashboard_stats
   (separate CRM tables)
```

## Credit System Flow

### CRM User Credits
```
Initial: 4 credits (FREE)
   ↓
Create Recording #1 → 3 credits remaining
   ↓
Create Recording #2 → 2 credits remaining
   ↓
Create Recording #3 → 1 credit remaining
   ↓
Create Recording #4 → 0 credits remaining
   ↓
Must pay $9.99 for 3 more credits
   ↓
Payment successful → 3 credits added
   ↓
Create Recording #5 → 2 credits remaining
   ↓
(Subsequent payments also give 3 credits)
```

### Regular User Credits
```
Initial: 0 credits
   ↓
Must pay $12.99 for first 3 credits
   ↓
Payment successful → 3 credits added
   ↓
Create Recording #1 → 2 credits remaining
   ↓
Create Recording #2 → 1 credit remaining
   ↓
Create Recording #3 → 0 credits remaining
   ↓
Must pay $9.99 for 3 more credits
   ↓
(All subsequent payments give 3 credits)
```

## Database Triggers & Functions

### Trigger Flow
```
┌─────────────────────────────────────────────────────────────┐
│  PAYMENT COMPLETED                                           │
│  (payment_details.status = 'completed')                     │
└─────────────────────────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  grant_credits_on_payment() TRIGGER                         │
│  - Check if user is CRM user (is_crm_user())               │
│  - If CRM user & first payment: +4 credits                 │
│  - If CRM user & subsequent: +3 credits                    │
│  - If regular user: +3 credits                             │
└─────────────────────────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  profiles.credits_remaining UPDATED                         │
└─────────────────────────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  sync_crm_credits() TRIGGER                                 │
│  - Syncs credits to digital_resume_by_CRM table            │
└─────────────────────────────────────────────────────────────┘
```

### Recording Creation Flow
```
┌─────────────────────────────────────────────────────────────┐
│  USER CREATES RECORDING                                      │
│  (Insert into crm_recordings or recordings)                 │
└─────────────────────────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  consume_credit_on_recording() TRIGGER                      │
│  - Check user has credits > 0                              │
│  - If yes: Allow & consume 1 credit                        │
│  - If no: Block with error                                 │
└─────────────────────────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  profiles.credits_remaining DECREASED                       │
└─────────────────────────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  update_crm_stats_on_recording() TRIGGER (CRM only)        │
│  - Increment total_recordings                              │
│  - Update last_recording_date                              │
└─────────────────────────────────────────────────────────────┘
```

## Frontend Integration Points

### 1. User Detection
```typescript
// Check if user is CRM user
const isCRMUser = await checkIfCRMUser(user.id);

// Use appropriate tables based on user type
const tableName = isCRMUser ? 'crm_job_requests' : 'job_requests';
```

### 2. Data Fetching
```typescript
// CRM User
if (isCRMUser) {
  const jobRequests = await supabase
    .from('crm_job_requests')
    .select('*')
    .eq('email', user.email);
}

// Regular User
else {
  const jobRequests = await supabase
    .from('job_requests')
    .select('*')
    .eq('user_id', user.id);
}
```

### 3. Dashboard Display
```typescript
// CRM User Dashboard
if (isCRMUser) {
  const stats = await supabase
    .rpc('get_crm_dashboard_data', { p_email: user.email });
  
  // Display:
  // - Total Applications: stats.total_applications
  // - Total Recordings: stats.total_recordings
  // - Total Resumes: stats.total_resumes
  // - Credits Remaining: stats.credits_remaining
}
```

## Security Model

### Row Level Security (RLS)
```
All CRM tables have RLS enabled:

┌─────────────────────────────────────────────────────────────┐
│  SELECT Policy: auth.uid() = user_id                        │
│  → Users can only view their own data                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  INSERT Policy: auth.uid() = user_id                        │
│  → Users can only insert their own data                     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  UPDATE Policy: auth.uid() = user_id                        │
│  → Users can only update their own data                     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  DELETE Policy: auth.uid() = user_id                        │
│  → Users can only delete their own data                     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Service Role: FULL ACCESS to all tables                    │
│  → For admin operations and sync function                   │
└─────────────────────────────────────────────────────────────┘
```

## Data Cascade

### When CRM User is Deleted
```
DELETE FROM digital_resume_by_CRM WHERE email = 'user@example.com'
   ↓
CASCADE DELETE:
   ├── crm_job_requests (all records with this email)
   ├── crm_recordings (all records with this email)
   ├── crm_resumes (all records with this email)
   └── crm_dashboard_stats (record with this email)
```

## Monitoring Queries

### Check CRM User Count
```sql
SELECT COUNT(*) as total_crm_users 
FROM digital_resume_by_CRM 
WHERE is_active = true;
```

### Check CRM Data Distribution
```sql
SELECT 
  'Job Requests' as data_type,
  COUNT(*) as count
FROM crm_job_requests
UNION ALL
SELECT 'Recordings', COUNT(*) FROM crm_recordings
UNION ALL
SELECT 'Resumes', COUNT(*) FROM crm_resumes;
```

### Check Credit Distribution
```sql
SELECT 
  credits_remaining,
  COUNT(*) as user_count
FROM digital_resume_by_CRM
GROUP BY credits_remaining
ORDER BY credits_remaining DESC;
```

## Complete File Structure

```
CareerCast-Applywizz/
├── supabase-functions/
│   ├── migrations/
│   │   ├── add_digital_resume_crm_table.sql      (Main CRM table + credit system)
│   │   └── add_crm_separate_tables.sql           (Separate CRM data tables)
│   ├── sync-crm-users/
│   │   └── index.ts                              (Sync function)
│   ├── CRM_INTEGRATION_GUIDE.md                  (Deployment guide)
│   └── CRM_SEPARATE_TABLES_GUIDE.md             (Architecture guide)
├── src/
│   ├── components/
│   │   └── Sidebar.tsx                           (Updated branding)
│   ├── pages/
│   │   ├── Auth.tsx                              (Updated branding)
│   │   └── Billing.tsx                           (Updated product name)
├── IMPLEMENTATION_SUMMARY.md                      (Overall summary)
└── CRM_SEPARATE_TABLES_SUMMARY.md                (Quick reference)
```

## Deployment Sequence

```
1. Run add_digital_resume_crm_table.sql
   ↓
2. Run add_crm_separate_tables.sql
   ↓
3. Set CRM database credentials as secrets
   ↓
4. Deploy sync-crm-users function
   ↓
5. Test sync function
   ↓
6. Update frontend code
   ↓
7. Deploy frontend
   ↓
8. Monitor and verify
```

## Success Metrics

Track these to measure success:

1. **CRM User Creation Rate:** Users created per sync
2. **Data Isolation:** 100% of CRM data in CRM tables
3. **Credit Accuracy:** Correct credit grants (4 initial, 3 subsequent)
4. **Dashboard Accuracy:** Stats match actual data
5. **Performance:** Query times for CRM vs regular users
