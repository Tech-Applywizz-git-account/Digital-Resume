# Digital Resume CRM Integration - Deployment Checklist

## Pre-Deployment Checklist

### ✅ Prerequisites
- [ ] Supabase project is set up and accessible
- [ ] Supabase CLI is installed (`npm install -g supabase`)
- [ ] Access to CRM Supabase database
- [ ] CRM database has `sales_closure` table with `digital_sale_resume` column
- [ ] Node.js and npm are installed
- [ ] Git repository is up to date

### ✅ Environment Setup
- [ ] `.env` file has all required variables
- [ ] CRM Supabase URL is available
- [ ] CRM Supabase anon key is available
- [ ] PayPal credentials are configured (if needed)

## Database Migration Checklist

### Step 1: Main CRM Table Migration
- [ ] Open Supabase SQL Editor
- [ ] Copy contents of `supabase-functions/migrations/add_digital_resume_crm_table.sql`
- [ ] Execute the migration
- [ ] Verify table created:
  ```sql
  SELECT table_name FROM information_schema.tables 
  WHERE table_name = 'digital_resume_by_CRM';
  ```
- [ ] Verify functions created:
  ```sql
  SELECT routine_name FROM information_schema.routines 
  WHERE routine_name IN ('is_crm_user', 'grant_credits_on_payment');
  ```
- [ ] Verify triggers created:
  ```sql
  SELECT trigger_name FROM information_schema.triggers 
  WHERE trigger_name IN ('payment_completed_grant_credits', 'sync_crm_credits');
  ```

### Step 2: Separate CRM Tables Migration
- [ ] Copy contents of `supabase-functions/migrations/add_crm_separate_tables.sql`
- [ ] Execute the migration
- [ ] Verify all tables created:
  ```sql
  SELECT table_name FROM information_schema.tables 
  WHERE table_name LIKE 'crm_%';
  -- Should return: crm_job_requests, crm_recordings, crm_resumes, crm_dashboard_stats
  ```
- [ ] Verify RLS is enabled:
  ```sql
  SELECT tablename, rowsecurity FROM pg_tables 
  WHERE tablename LIKE 'crm_%';
  -- All should have rowsecurity = true
  ```
- [ ] Verify foreign keys:
  ```sql
  SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
  JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name LIKE 'crm_%';
  ```

## Edge Function Deployment Checklist

### Step 3: Configure Secrets
- [ ] Set CRM database URL:
  ```bash
  supabase secrets set CRM_SUPABASE_URL=your_crm_url
  ```
- [ ] Set CRM database anon key:
  ```bash
  supabase secrets set CRM_SUPABASE_ANON_KEY=your_crm_key
  ```
- [ ] Verify secrets are set:
  ```bash
  supabase secrets list
  ```

### Step 4: Deploy Sync Function
- [ ] Login to Supabase:
  ```bash
  supabase login
  ```
- [ ] Link to project:
  ```bash
  supabase link --project-ref your-project-ref
  ```
- [ ] Deploy function:
  ```bash
  supabase functions deploy sync-crm-users
  ```
- [ ] Verify deployment:
  ```bash
  supabase functions list
  ```

## Testing Checklist

### Step 5: Test Sync Function
- [ ] Ensure test data exists in CRM database:
  ```sql
  -- In CRM database
  SELECT email, digital_sale_resume FROM sales_closure 
  WHERE digital_sale_resume > 0 LIMIT 5;
  ```
- [ ] Invoke sync function:
  ```bash
  supabase functions invoke sync-crm-users --no-verify-jwt
  ```
- [ ] Check response for success
- [ ] Verify users created in `auth.users`:
  ```sql
  SELECT email, created_at FROM auth.users 
  ORDER BY created_at DESC LIMIT 5;
  ```
- [ ] Verify profiles created with 4 credits:
  ```sql
  SELECT p.email, p.credits_remaining 
  FROM profiles p
  JOIN digital_resume_by_CRM crm ON crm.user_id = p.id
  ORDER BY p.created_at DESC LIMIT 5;
  ```
- [ ] Verify CRM tracking records:
  ```sql
  SELECT email, credits_remaining, user_created_at 
  FROM digital_resume_by_CRM 
  ORDER BY user_created_at DESC LIMIT 5;
  ```
- [ ] Verify dashboard stats created:
  ```sql
  SELECT email, total_applications, total_recordings, total_resumes 
  FROM crm_dashboard_stats 
  ORDER BY created_at DESC LIMIT 5;
  ```

### Step 6: Test CRM User Login
- [ ] Get test user email from CRM database
- [ ] Try logging in with:
  - Email: (from CRM)
  - Password: `Applywizz@123`
- [ ] Verify successful login
- [ ] Check user has 4 credits in dashboard
- [ ] Verify user can access the application

### Step 7: Test CRM Data Creation
- [ ] Login as CRM user
- [ ] Create a job request:
  ```typescript
  await supabase.from('crm_job_requests').insert({
    email: user.email,
    user_id: user.id,
    job_title: 'Test Job',
    company_name: 'Test Company'
  });
  ```
- [ ] Verify job request created:
  ```sql
  SELECT * FROM crm_job_requests WHERE email = 'test@example.com';
  ```
- [ ] Verify dashboard stats updated:
  ```sql
  SELECT total_applications FROM crm_dashboard_stats 
  WHERE email = 'test@example.com';
  -- Should be 1
  ```

### Step 8: Test Recording Creation
- [ ] Create a recording for CRM user:
  ```typescript
  await supabase.from('crm_recordings').insert({
    email: user.email,
    user_id: user.id,
    job_request_id: jobRequestId,
    video_url: 'https://example.com/video.mp4'
  });
  ```
- [ ] Verify recording created:
  ```sql
  SELECT * FROM crm_recordings WHERE email = 'test@example.com';
  ```
- [ ] Verify credit consumed:
  ```sql
  SELECT credits_remaining FROM profiles 
  WHERE email = 'test@example.com';
  -- Should be 3 (was 4, now 3)
  ```
- [ ] Verify dashboard stats updated:
  ```sql
  SELECT total_recordings FROM crm_dashboard_stats 
  WHERE email = 'test@example.com';
  -- Should be 1
  ```

### Step 9: Test Credit System
- [ ] Create 3 more recordings (total 4)
- [ ] Verify credits decrease: 3 → 2 → 1 → 0
- [ ] Try to create 5th recording
- [ ] Verify error: "Insufficient credits"
- [ ] Go to billing page
- [ ] Make $9.99 payment
- [ ] Verify 3 credits added (not 4)
- [ ] Verify total credits = 3

### Step 10: Test Data Isolation
- [ ] Verify CRM user data is NOT in regular tables:
  ```sql
  SELECT COUNT(*) FROM job_requests 
  WHERE user_id IN (SELECT user_id FROM digital_resume_by_CRM);
  -- Should be 0
  ```
- [ ] Verify CRM user data IS in CRM tables:
  ```sql
  SELECT COUNT(*) FROM crm_job_requests 
  WHERE email IN (SELECT email FROM digital_resume_by_CRM);
  -- Should be > 0
  ```

## Frontend Deployment Checklist

### Step 11: Update Frontend Code
- [ ] Add CRM user detection logic
- [ ] Update all queries to check if user is CRM user
- [ ] Use `crm_*` tables for CRM users
- [ ] Use regular tables for regular users
- [ ] Test locally with both user types

### Step 12: Build and Deploy
- [ ] Run tests:
  ```bash
  npm test
  ```
- [ ] Build production bundle:
  ```bash
  npm run build
  ```
- [ ] Deploy to hosting platform:
  ```bash
  vercel --prod
  # or
  netlify deploy --prod
  ```
- [ ] Verify deployment successful

## Post-Deployment Verification

### Step 13: Production Verification
- [ ] Test CRM user sync in production
- [ ] Test CRM user login in production
- [ ] Test data creation in production
- [ ] Test credit system in production
- [ ] Test payment flow in production
- [ ] Monitor error logs for 24 hours
- [ ] Check database performance

### Step 14: Monitoring Setup
- [ ] Set up alerts for sync failures
- [ ] Set up alerts for credit system errors
- [ ] Set up dashboard for CRM user metrics
- [ ] Document monitoring procedures

## Optional: Automated Sync Setup

### Step 15: Set Up Cron Job (Optional)
- [ ] Choose cron method (Supabase cron or external)
- [ ] Configure cron schedule (e.g., every 6 hours)
- [ ] Test cron execution
- [ ] Monitor cron job logs

**Supabase Cron Example:**
```sql
SELECT cron.schedule(
  'sync-crm-users-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/sync-crm-users',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'))
  );
  $$
);
```

## Documentation Checklist

### Step 16: Update Documentation
- [ ] Update README with CRM integration info
- [ ] Document CRM user flow for support team
- [ ] Create user guide for CRM users
- [ ] Update API documentation (if applicable)
- [ ] Document troubleshooting steps

## Rollback Plan

### If Issues Occur
- [ ] Have backup of database before migration
- [ ] Know how to disable CRM user creation:
  ```sql
  UPDATE digital_resume_by_CRM SET is_active = false;
  ```
- [ ] Know how to rollback migrations:
  ```sql
  -- See rollback section in migration files
  ```
- [ ] Have contact info for support team

## Success Criteria

### Deployment is Successful When:
- [ ] All migrations run without errors
- [ ] Sync function deploys successfully
- [ ] Test CRM user can be created
- [ ] Test CRM user can login
- [ ] Test CRM user can create data
- [ ] Credits system works correctly
- [ ] Payment flow works correctly
- [ ] Dashboard stats update correctly
- [ ] No errors in production logs
- [ ] Performance is acceptable

## Final Checklist

- [ ] All database migrations completed
- [ ] All edge functions deployed
- [ ] All tests passed
- [ ] Frontend deployed
- [ ] Documentation updated
- [ ] Team trained on new features
- [ ] Monitoring set up
- [ ] Rollback plan documented
- [ ] Success criteria met

## Sign-Off

- [ ] Database Admin: _________________ Date: _______
- [ ] Backend Developer: ______________ Date: _______
- [ ] Frontend Developer: _____________ Date: _______
- [ ] QA Engineer: ___________________ Date: _______
- [ ] Product Manager: _______________ Date: _______

---

## Quick Reference Commands

### Database
```bash
# Run migration
supabase db push

# Check tables
supabase db inspect

# View logs
supabase db logs
```

### Edge Functions
```bash
# Deploy function
supabase functions deploy sync-crm-users

# Test function
supabase functions invoke sync-crm-users --no-verify-jwt

# View logs
supabase functions logs sync-crm-users
```

### Secrets
```bash
# Set secret
supabase secrets set KEY=value

# List secrets
supabase secrets list

# Delete secret
supabase secrets unset KEY
```

### Monitoring
```sql
-- Check CRM user count
SELECT COUNT(*) FROM digital_resume_by_CRM WHERE is_active = true;

-- Check recent syncs
SELECT email, user_created_at FROM digital_resume_by_CRM 
ORDER BY user_created_at DESC LIMIT 10;

-- Check credit distribution
SELECT credits_remaining, COUNT(*) FROM digital_resume_by_CRM 
GROUP BY credits_remaining;

-- Check dashboard stats
SELECT * FROM crm_dashboard_stats ORDER BY updated_at DESC LIMIT 10;
```

---

**Deployment Date:** _______________
**Deployed By:** _______________
**Version:** 1.0.0
