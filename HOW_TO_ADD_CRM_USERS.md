# How to Add New Users to the CRM Dashboard

## Quick Methods

### Method 1: Using SQL Editor (Simplest)

1. **Open Supabase Dashboard** → SQL Editor
2. **Run this query:**

```sql
-- Add a single user
INSERT INTO public.digital_resume_by_crm (email, credits_remaining, is_active)
VALUES ('newuser@example.com', 4, true);
```

**Replace `newuser@example.com` with the actual email.**

### Method 2: Using the Helper Function (Recommended)

I've created a helper function that handles validation and automatically creates dashboard stats.

#### Step 1: Install the function
1. Open SQL Editor
2. Copy and run: `supabase-functions/migrations/add_crm_user_function.sql`

#### Step 2: Use the function

```sql
-- Add a single user with default 4 credits
SELECT add_crm_user('newuser@example.com');

-- Add a user with 10 credits
SELECT add_crm_user('newuser@example.com', 10);

-- Add multiple users at once
SELECT bulk_add_crm_users(ARRAY[
  'user1@example.com',
  'user2@example.com',
  'user3@example.com'
]);
```

The function will:
- ✅ Validate email format
- ✅ Check for duplicates
- ✅ Create CRM user record
- ✅ Set up initial dashboard stats
- ✅ Return success/error message

## Advanced: Linking to Existing Auth Users

If someone already has a regular account and you want to convert them to CRM:

```sql
-- Step 1: Find their auth user_id
SELECT id, email FROM auth.users WHERE email = 'user@example.com';

-- Step 2: Add them to CRM with the user_id
SELECT add_crm_user('user@example.com', 4, 'USER_ID_FROM_STEP_1');
```

## Viewing CRM Users

```sql
-- View all CRM users
SELECT 
  email,
  credits_remaining,
  is_active,
  user_created_at,
  last_sync_at
FROM digital_resume_by_crm 
ORDER BY user_created_at DESC;

-- View CRM users with their stats
SELECT 
  crm.email,
  crm.credits_remaining,
  COALESCE(stats.total_applications, 0) as applications,
  COALESCE(stats.total_recordings, 0) as recordings,
  COALESCE(stats.total_resumes, 0) as resumes
FROM digital_resume_by_crm crm
LEFT JOIN crm_dashboard_stats stats ON stats.email = crm.email
ORDER BY crm.user_created_at DESC;
```

## Managing CRM Users

### Update Credits
```sql
UPDATE digital_resume_by_crm 
SET credits_remaining = 10 
WHERE email = 'user@example.com';
```

### Activate/Deactivate User
```sql
-- Deactivate
UPDATE digital_resume_by_crm 
SET is_active = false 
WHERE email = 'user@example.com';

-- Activate
UPDATE digital_resume_by_crm 
SET is_active = true 
WHERE email = 'user@example.com';
```

### Delete User
```sql
-- This will cascade delete all related data (job requests, recordings, resumes)
DELETE FROM digital_resume_by_crm 
WHERE email = 'user@example.com';
```

## Bulk Import from CSV

If you have a CSV file with emails:

1. **Prepare your data:**
```csv
email,credits
user1@example.com,4
user2@example.com,4
user3@example.com,10
```

2. **Use the bulk function:**
```sql
SELECT bulk_add_crm_users(ARRAY[
  'user1@example.com',
  'user2@example.com',
  'user3@example.com'
]);
```

Or insert directly:
```sql
INSERT INTO digital_resume_by_crm (email, credits_remaining, is_active)
VALUES 
  ('user1@example.com', 4, true),
  ('user2@example.com', 4, true),
  ('user3@example.com', 10, true);
```

## Verification

After adding users, verify they were created:

```sql
-- Check if user exists in CRM
SELECT * FROM digital_resume_by_crm 
WHERE email = 'newuser@example.com';

-- Check dashboard stats were created
SELECT * FROM crm_dashboard_stats 
WHERE email = 'newuser@example.com';
```

## What Happens When You Add a CRM User?

When you add a user to `digital_resume_by_crm`:

1. **User gets 4 credits by default** (customizable)
2. **Dashboard stats record is created** (if using the function)
3. **User can immediately:**
   - Upload resumes (stored in `CRM_users_resumes` bucket)
   - Record videos (stored in `CRM_users_recordings` bucket)
   - Their data is tracked separately from regular users

## Differences: CRM Users vs Regular Users

| Feature | CRM Users | Regular Users |
|---------|-----------|---------------|
| Table | `digital_resume_by_crm` | `profiles` |
| Job Requests | `crm_job_requests` | `job_requests` |
| Recordings | `crm_recordings` | `recordings` |
| Resumes Bucket | `CRM_users_resumes` | `resumes` |
| Recordings Bucket | `CRM_users_recordings` | `recordings` |
| Identified By | Email | User ID |

## Troubleshooting

### Error: "duplicate key value violates unique constraint"
- User already exists. Check with:
```sql
SELECT * FROM digital_resume_by_crm WHERE email = 'user@example.com';
```

### Error: "foreign key constraint violation"
- If linking to auth user, make sure the user_id exists:
```sql
SELECT id FROM auth.users WHERE id = 'USER_ID_HERE';
```

---

**Need to create an admin UI for this?** Let me know and I can create a React component for managing CRM users!
