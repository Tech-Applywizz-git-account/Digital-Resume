# Digital Resume CRM Integration - Deployment Guide

## Overview
This guide explains how to deploy the new CRM integration feature that automatically creates users from an external Supabase CRM database.

## Prerequisites
- Access to your main Supabase project
- Access to the CRM Supabase database (with `sales_closure` table)
- Supabase CLI installed
- Node.js and npm installed

## Step 1: Run Database Migrations

### 1.1 Apply the CRM Table Migration

Run the migration to create the `digital_resume_by_CRM` table and update the credit system:

```bash
# Navigate to your project directory
cd "c:\Users\DELL\Desktop\CareerCast-Applywizz - Copy"

# Run the migration in Supabase SQL Editor
# Copy the contents of: supabase-functions/migrations/add_digital_resume_crm_table.sql
# And execute it in your Supabase SQL Editor
```

Or if you have Supabase CLI configured:

```bash
supabase db push
```

### 1.2 Verify Migration

Run these queries in Supabase SQL Editor to verify:

```sql
-- Check if table exists
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'digital_resume_by_CRM';

-- Check if functions exist
SELECT routine_name FROM information_schema.routines 
WHERE routine_name IN ('is_crm_user', 'grant_credits_on_payment', 'sync_crm_credits_on_profile_update');

-- Check if triggers exist
SELECT trigger_name FROM information_schema.triggers 
WHERE trigger_name IN ('payment_completed_grant_credits', 'sync_crm_credits');
```

## Step 2: Configure Environment Variables

### 2.1 Add CRM Database Credentials

You need to add the CRM Supabase credentials to your environment:

**For Local Development (.env):**
```env
# Existing variables...
VITE_SUPABASE_URL=your_main_supabase_url
VITE_SUPABASE_ANON_KEY=your_main_supabase_anon_key

# New CRM variables
CRM_SUPABASE_URL=your_crm_supabase_url
CRM_SUPABASE_ANON_KEY=your_crm_supabase_anon_key
```

**For Supabase Edge Functions:**

You need to set these as Supabase secrets:

```bash
# Set CRM credentials as secrets
supabase secrets set CRM_SUPABASE_URL=your_crm_supabase_url
supabase secrets set CRM_SUPABASE_ANON_KEY=your_crm_supabase_anon_key
```

Or via Supabase Dashboard:
1. Go to Project Settings > Edge Functions
2. Add the following secrets:
   - `CRM_SUPABASE_URL`
   - `CRM_SUPABASE_ANON_KEY`

## Step 3: Deploy Supabase Edge Function

### 3.1 Deploy sync-crm-users Function

```bash
# Login to Supabase (if not already logged in)
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Deploy the function
supabase functions deploy sync-crm-users
```

### 3.2 Verify Deployment

Test the function:

```bash
# Test the function
supabase functions invoke sync-crm-users --no-verify-jwt
```

Or via HTTP:

```bash
curl -X POST \
  'https://your-project-ref.supabase.co/functions/v1/sync-crm-users' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json'
```

## Step 4: Update Frontend Code

The frontend code has already been updated with the following changes:

### 4.1 Branding Changes
- ✅ "NetworkNote" → "Digital Resume" in Sidebar
- ✅ "NetworkNote" → "Digital Resume" in Auth page
- ✅ "CareerCast Credits" → "Digital Resume Credits" in Billing
- ✅ Product descriptions updated

### 4.2 Deploy Frontend

```bash
# Build the frontend
npm run build

# Deploy to Vercel (or your hosting platform)
vercel --prod
```

## Step 5: Set Up Automated CRM Sync (Optional)

You can set up a cron job to automatically sync CRM users periodically.

### Option A: Supabase Cron (Recommended)

Create a cron job in Supabase:

```sql
-- Create a cron job to run sync every hour
SELECT cron.schedule(
  'sync-crm-users-hourly',
  '0 * * * *', -- Every hour
  $$
  SELECT net.http_post(
    url := 'https://your-project-ref.supabase.co/functions/v1/sync-crm-users',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
    body := '{}'::jsonb
  );
  $$
);
```

### Option B: External Cron Service

Use a service like cron-job.org or GitHub Actions to call the edge function periodically.

**GitHub Actions Example (.github/workflows/sync-crm.yml):**

```yaml
name: Sync CRM Users

on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
  workflow_dispatch:  # Manual trigger

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Call Sync Function
        run: |
          curl -X POST \
            '${{ secrets.SUPABASE_URL }}/functions/v1/sync-crm-users' \
            -H 'Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}' \
            -H 'Content-Type: application/json'
```

## Step 6: Testing

### 6.1 Manual Sync Test

1. Ensure you have test data in the CRM `sales_closure` table with `digital_sale_resume > 0`
2. Call the sync function manually:
   ```bash
   supabase functions invoke sync-crm-users --no-verify-jwt
   ```
3. Check the response for created users
4. Verify in Supabase Dashboard:
   - Check `auth.users` for new users
   - Check `profiles` table for 4 credits
   - Check `digital_resume_by_CRM` table for tracking records

### 6.2 Login Test

1. Try logging in with a CRM-created user:
   - Email: (from CRM database)
   - Password: `Applywizz@123`
2. Verify the user has 4 credits
3. Create a digital resume to consume 1 credit
4. Verify credits decrease to 3

### 6.3 Payment Flow Test

1. Use all 4 credits
2. Go to Billing page
3. Purchase more credits for $9.99
4. Verify 3 more credits are added (not 4)

## Step 7: Email Notifications (TODO)

Currently, the sync function logs that an email should be sent but doesn't actually send it. To implement email notifications:

### Option A: Use Supabase Auth Email Templates

Modify the edge function to trigger a password reset email:

```typescript
// In sync-crm-users/index.ts
await supabase.auth.admin.generateLink({
  type: 'magiclink',
  email: crmUser.email,
})
```

### Option B: Use a Third-Party Email Service

Integrate with SendGrid, Resend, or similar:

```typescript
// Example with Resend
const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

await resend.emails.send({
  from: 'noreply@yourapp.com',
  to: crmUser.email,
  subject: 'Welcome to Digital Resume',
  html: `
    <h1>Welcome!</h1>
    <p>Your account has been created.</p>
    <p>Email: ${crmUser.email}</p>
    <p>Password: Applywizz@123</p>
    <p>Please login and change your password.</p>
  `
});
```

## Troubleshooting

### Issue: Function fails with "Missing CRM credentials"

**Solution:** Ensure CRM_SUPABASE_URL and CRM_SUPABASE_ANON_KEY are set as Supabase secrets.

### Issue: Users created but no credits

**Solution:** Check that the `grant_credits_on_payment` trigger is working. Run:
```sql
SELECT * FROM pg_trigger WHERE tgname = 'payment_completed_grant_credits';
```

### Issue: Duplicate user errors

**Solution:** The function checks for existing users. If you see this error, it means the user already exists and will be skipped.

### Issue: Credits not syncing between tables

**Solution:** Verify the `sync_crm_credits` trigger is active:
```sql
SELECT * FROM pg_trigger WHERE tgname = 'sync_crm_credits';
```

## Monitoring

### Check Sync Status

```sql
-- View all CRM users
SELECT * FROM digital_resume_by_CRM ORDER BY user_created_at DESC;

-- View recent syncs
SELECT email, user_created_at, last_sync_at, credits_remaining 
FROM digital_resume_by_CRM 
WHERE last_sync_at > NOW() - INTERVAL '24 hours';

-- Check for inactive CRM users
SELECT * FROM digital_resume_by_CRM WHERE is_active = false;
```

### View Edge Function Logs

```bash
# View recent logs
supabase functions logs sync-crm-users

# Follow logs in real-time
supabase functions logs sync-crm-users --follow
```

## Security Considerations

1. **CRM Database Access:** Ensure the CRM Supabase anon key has read-only access to `sales_closure` table
2. **Password Security:** Consider implementing a password change requirement on first login
3. **Rate Limiting:** Consider adding rate limiting to the sync function to prevent abuse
4. **Data Privacy:** Ensure compliance with GDPR/privacy laws when syncing user data

## Rollback Plan

If you need to rollback this feature:

```sql
-- Disable CRM user creation (mark all as inactive)
UPDATE digital_resume_by_CRM SET is_active = false;

-- Or completely remove the feature
DROP TRIGGER IF EXISTS payment_completed_grant_credits ON payment_details;
DROP TRIGGER IF EXISTS sync_crm_credits ON profiles;
DROP FUNCTION IF EXISTS grant_credits_on_payment();
DROP FUNCTION IF EXISTS sync_crm_credits_on_profile_update();
DROP FUNCTION IF EXISTS is_crm_user(uuid);
DROP TABLE IF EXISTS digital_resume_by_CRM;

-- Restore original credit grant function (3 credits for everyone)
-- Run the original add_credits_system.sql migration
```

## Support

For issues or questions:
1. Check Supabase Dashboard logs
2. Review Edge Function logs
3. Check database trigger logs
4. Contact development team

## Next Steps

After successful deployment:

1. ✅ Monitor the first sync batch
2. ✅ Verify email notifications are sent
3. ✅ Test the complete user journey
4. ✅ Set up monitoring alerts
5. ✅ Document the process for the team
6. ✅ Train support team on CRM user flow
