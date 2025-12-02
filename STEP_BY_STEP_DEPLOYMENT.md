# Digital Resume CRM Integration - Step-by-Step Deployment Guide

## 📋 Prerequisites Checklist

Before we start, make sure you have:

- [ ] Supabase account (https://supabase.com)
- [ ] Your main Supabase project created
- [ ] Access to CRM Supabase database (the external database with sales_closure table)
- [ ] Node.js installed (v16 or higher)
- [ ] npm installed
- [ ] Git installed (optional but recommended)

---

## 🔑 Credentials You'll Need

### 1. **Your Main Supabase Project Credentials**
You'll need these from your Supabase dashboard:

- **Project URL** (looks like: `https://xxxxxxxxxxxxx.supabase.co`)
- **Project Reference ID** (looks like: `xxxxxxxxxxxxx`)
- **Anon/Public Key** (starts with: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)
- **Service Role Key** (starts with: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`) ⚠️ Keep this secret!

**Where to find them:**
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **Settings** → **API**
4. You'll see:
   - Project URL
   - Project API keys (anon key and service_role key)

### 2. **CRM Supabase Database Credentials**
You'll need these from the external CRM database:

- **CRM Supabase URL** (looks like: `https://yyyyyyyyyyyyy.supabase.co`)
- **CRM Anon Key** (starts with: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)

**Where to get them:**
- Ask your CRM database administrator OR
- If you have access, go to the CRM Supabase project → Settings → API

### 3. **PayPal Credentials** (if not already set up)
- **PayPal Client ID** (for production or sandbox)

---

## 📝 Step-by-Step Deployment

### **STEP 1: Verify Your Environment**

1. Open your terminal in the project directory:
   ```bash
   cd "c:\Users\DELL\Desktop\CareerCast-Applywizz - Copy"
   ```

2. Check if you have the required files:
   ```bash
   dir supabase-functions\migrations
   ```
   
   You should see:
   - `add_digital_resume_crm_table.sql`
   - `add_crm_separate_tables.sql`

3. Check if Supabase CLI is installed:
   ```bash
   supabase --version
   ```
   
   If not installed, install it:
   ```bash
   npm install -g supabase
   ```

---

### **STEP 2: Login to Supabase**

1. Login to Supabase CLI:
   ```bash
   supabase login
   ```
   
   This will open a browser window. Login with your Supabase account.

2. Link your project:
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```
   
   Replace `YOUR_PROJECT_REF` with your project reference ID (the part before `.supabase.co` in your URL)

   Example:
   ```bash
   supabase link --project-ref abcdefghijklmno
   ```

---

### **STEP 3: Run Database Migrations**

#### 3.1 Run First Migration (CRM Main Table)

1. Open Supabase Dashboard in browser:
   - Go to https://supabase.com/dashboard
   - Select your project
   - Click on **SQL Editor** in the left sidebar

2. Create a new query:
   - Click **New Query** button

3. Copy the first migration:
   - Open file: `supabase-functions/migrations/add_digital_resume_crm_table.sql`
   - Copy ALL the contents (Ctrl+A, Ctrl+C)

4. Paste into SQL Editor and run:
   - Paste the SQL (Ctrl+V)
   - Click **Run** button (or press Ctrl+Enter)

5. Verify success:
   - You should see "Success. No rows returned"
   - Run this verification query:
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_name = 'digital_resume_by_CRM';
   ```
   - Should return 1 row with `digital_resume_by_CRM`

#### 3.2 Run Second Migration (CRM Separate Tables)

1. In the same SQL Editor, create another new query

2. Copy the second migration:
   - Open file: `supabase-functions/migrations/add_crm_separate_tables.sql`
   - Copy ALL the contents

3. Paste and run:
   - Paste the SQL
   - Click **Run**

4. Verify success:
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_name LIKE 'crm_%';
   ```
   - Should return 4 rows:
     - `crm_job_requests`
     - `crm_recordings`
     - `crm_resumes`
     - `crm_dashboard_stats`

5. Verify storage buckets created:
   ```sql
   SELECT id, name FROM storage.buckets 
   WHERE name LIKE 'CRM_%';
   ```
   - Should return 2 rows:
     - `CRM_users_resumes`
     - `CRM_users_recordings`

---

### **STEP 4: Configure CRM Database Credentials**

Now we need to set up the connection to the external CRM database.

1. Set CRM credentials as Supabase secrets:
   ```bash
   supabase secrets set CRM_SUPABASE_URL=https://your-crm-project.supabase.co
   ```
   
   Replace with your actual CRM Supabase URL.

2. Set CRM anon key:
   ```bash
   supabase secrets set CRM_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
   
   Replace with your actual CRM anon key.

3. Verify secrets are set:
   ```bash
   supabase secrets list
   ```
   
   You should see:
   - `CRM_SUPABASE_URL`
   - `CRM_SUPABASE_ANON_KEY`

**Alternative: Set via Dashboard**
If CLI doesn't work, you can set secrets via dashboard:
1. Go to Supabase Dashboard → Your Project
2. Click **Edge Functions** in sidebar
3. Click **Manage secrets**
4. Add:
   - Key: `CRM_SUPABASE_URL`, Value: `https://your-crm-project.supabase.co`
   - Key: `CRM_SUPABASE_ANON_KEY`, Value: `your_crm_anon_key`

---

### **STEP 5: Deploy Edge Function**

1. Deploy the sync function:
   ```bash
   supabase functions deploy sync-crm-users
   ```

2. Wait for deployment to complete. You should see:
   ```
   Deploying function sync-crm-users...
   Function deployed successfully!
   ```

3. Verify deployment:
   ```bash
   supabase functions list
   ```
   
   You should see `sync-crm-users` in the list.

---

### **STEP 6: Test the Sync Function**

#### 6.1 Prepare Test Data in CRM Database

First, make sure you have test data in your CRM database:

1. Login to your CRM Supabase dashboard
2. Go to **Table Editor**
3. Find the `sales_closure` table
4. Verify you have at least one row where `digital_sale_resume > 0`

Example test data:
```sql
-- Run this in CRM database if you need test data
INSERT INTO sales_closure (email, digital_sale_resume)
VALUES ('test@example.com', 1);
```

#### 6.2 Run the Sync Function

1. Test the function:
   ```bash
   supabase functions invoke sync-crm-users --no-verify-jwt
   ```

2. Check the response. You should see something like:
   ```json
   {
     "success": true,
     "summary": {
       "total": 1,
       "created": 1,
       "alreadyExists": 0,
       "errors": 0
     },
     "results": [
       {
         "email": "test@example.com",
         "status": "created",
         "user_id": "uuid-here"
       }
     ]
   }
   ```

#### 6.3 Verify User Created

1. Go to your main Supabase dashboard
2. Go to **Authentication** → **Users**
3. You should see the new user with email from CRM

4. Verify in database:
   ```sql
   -- Check if user exists in digital_resume_by_CRM
   SELECT email, credits_remaining, user_created_at 
   FROM digital_resume_by_CRM 
   ORDER BY user_created_at DESC 
   LIMIT 5;
   ```
   
   Should show the new user with 4 credits.

5. Verify dashboard stats created:
   ```sql
   SELECT email, total_applications, total_recordings, total_resumes 
   FROM crm_dashboard_stats 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```

---

### **STEP 7: Test CRM User Login**

1. Go to your application login page (http://localhost:5173 or your deployed URL)

2. Try logging in with:
   - **Email:** test@example.com (or the email from CRM)
   - **Password:** Applywizz@123

3. You should be able to login successfully!

4. Check the dashboard - you should see **4 credits**

---

### **STEP 8: Update Frontend Code**

Now we need to update the frontend to use CRM tables for CRM users.

#### 8.1 Create Helper Function to Detect CRM Users

Create a new file: `src/utils/crmHelpers.ts`

```typescript
import { supabase } from '../integrations/supabase/client';

export const isCRMUser = async (userId: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('digital_resume_by_CRM')
    .select('email')
    .eq('user_id', userId)
    .single();

  return !!data && !error;
};

export const getCRMUserEmail = async (userId: string): Promise<string | null> => {
  const { data } = await supabase
    .from('digital_resume_by_CRM')
    .select('email')
    .eq('user_id', userId)
    .single();

  return data?.email || null;
};
```

#### 8.2 Update Components to Use CRM Tables

You'll need to update components that fetch/create data to check if user is CRM user first.

Example pattern:
```typescript
// In your Dashboard or data fetching component
const fetchUserData = async () => {
  const isCRM = await isCRMUser(user.id);
  
  if (isCRM) {
    // Fetch from CRM tables
    const { data } = await supabase
      .from('crm_job_requests')
      .select('*')
      .eq('email', user.email);
  } else {
    // Fetch from regular tables
    const { data } = await supabase
      .from('job_requests')
      .select('*')
      .eq('user_id', user.id);
  }
};
```

---

### **STEP 9: Deploy Frontend**

1. Build the frontend:
   ```bash
   npm run build
   ```

2. Deploy to Vercel (or your hosting platform):
   ```bash
   vercel --prod
   ```

3. Or if using another platform, follow their deployment instructions.

---

### **STEP 10: Set Up Automated Sync (Optional)**

To automatically sync CRM users periodically:

#### Option A: Using Supabase Cron

1. Go to Supabase Dashboard → SQL Editor
2. Run this query:

```sql
SELECT cron.schedule(
  'sync-crm-users-hourly',
  '0 * * * *', -- Every hour
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/sync-crm-users',
    headers := jsonb_build_object(
      'Authorization', 
      'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Replace `YOUR_PROJECT_REF` with your actual project reference.

#### Option B: Manual Sync

You can manually trigger sync anytime:
```bash
supabase functions invoke sync-crm-users --no-verify-jwt
```

---

## ✅ Verification Checklist

After completing all steps, verify:

- [ ] Both migrations ran successfully
- [ ] Storage buckets created (`CRM_users_resumes`, `CRM_users_recordings`)
- [ ] CRM credentials set as secrets
- [ ] Edge function deployed
- [ ] Test sync created a user
- [ ] Can login with CRM user (password: Applywizz@123)
- [ ] CRM user has 4 credits
- [ ] Dashboard stats record exists
- [ ] Frontend updated to use CRM tables
- [ ] Frontend deployed

---

## 🎯 Quick Test Workflow

To quickly test everything works:

1. **Sync a user:**
   ```bash
   supabase functions invoke sync-crm-users --no-verify-jwt
   ```

2. **Login as CRM user:**
   - Email: (from CRM database)
   - Password: Applywizz@123

3. **Check credits:**
   - Should see 4 credits in dashboard

4. **Create a job request:**
   - Use the application to create a job request
   - Verify it appears in `crm_job_requests` table

5. **Create a recording:**
   - Record a video
   - Verify it appears in `crm_recordings` table
   - Verify credits decrease to 3

6. **Check dashboard stats:**
   ```sql
   SELECT * FROM crm_dashboard_stats WHERE email = 'your-test-email';
   ```
   - Should show: total_applications = 1, total_recordings = 1

---

## 🆘 Troubleshooting

### Issue: "Cannot find module" when deploying function
**Solution:** Make sure you're in the project root directory:
```bash
cd "c:\Users\DELL\Desktop\CareerCast-Applywizz - Copy"
```

### Issue: "Project not linked"
**Solution:** Link your project:
```bash
supabase link --project-ref YOUR_PROJECT_REF
```

### Issue: Sync function returns "Missing CRM credentials"
**Solution:** Set the secrets:
```bash
supabase secrets set CRM_SUPABASE_URL=your_url
supabase secrets set CRM_SUPABASE_ANON_KEY=your_key
```

### Issue: User created but no credits
**Solution:** Check if trigger is working:
```sql
SELECT trigger_name FROM information_schema.triggers 
WHERE trigger_name = 'payment_completed_grant_credits';
```

### Issue: Cannot login with Applywizz@123
**Solution:** Check if user was created:
```sql
SELECT email FROM auth.users ORDER BY created_at DESC LIMIT 5;
```

---

## 📞 Need Help?

If you get stuck at any step:

1. Check the error message carefully
2. Look at the troubleshooting section above
3. Check Supabase logs:
   - Dashboard → Logs → Edge Functions
   - Dashboard → Logs → Database
4. Verify all credentials are correct
5. Make sure CRM database is accessible

---

## 🎉 Success!

Once all steps are complete, you'll have:

✅ CRM users automatically synced from external database  
✅ CRM users get 4 free credits  
✅ Separate tables for CRM user data  
✅ Dedicated storage buckets for files  
✅ Automatic dashboard stats tracking  
✅ Complete payment flow for additional credits  

Your Digital Resume CRM Integration is now live! 🚀
