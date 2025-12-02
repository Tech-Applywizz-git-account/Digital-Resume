# CRM Database Setup Instructions

## Step 1: Add CRM Credentials to .env File

Open your `.env` file and add these lines at the end:

```env
# CRM Supabase Database Credentials (External - Read Only)
CRM_SUPABASE_URL=https://mrsmhqgdwjopaspnpohwu.supabase.co
CRM_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yc21ocWdkd2pvcGFzbnBvaHd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0NDcwNTAsImV4cCI6MjA2NzAyMzA1MH0.gT89NQPLbOQi0B5P0lT6PKqbH-7TMXBmA8IXrGtkT8o
```

**Note:** We only need the ANON key for read-only access. The service_role key is not needed.

---

## Step 2: Set Supabase Secrets (for Edge Function)

The edge function runs on Supabase servers, so it needs the credentials set as secrets.

Open your terminal and run these commands:

### 2.1 Login to Supabase (if not already logged in)
```bash
supabase login
```

### 2.2 Link your project (if not already linked)
First, you need your main project reference ID. Run:
```bash
supabase link
```

Follow the prompts to select your project.

### 2.3 Set CRM URL as secret
```bash
supabase secrets set CRM_SUPABASE_URL=https://mrsmhqgdwjopaspnpohwu.supabase.co
```

### 2.4 Set CRM Anon Key as secret
```bash
supabase secrets set CRM_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yc21ocWdkd2pvcGFzbnBvaHd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0NDcwNTAsImV4cCI6MjA2NzAyMzA1MH0.gT89NQPLbOQi0B5P0lT6PKqbH-7TMXBmA8IXrGtkT8o
```

### 2.5 Verify secrets are set
```bash
supabase secrets list
```

You should see:
```
CRM_SUPABASE_URL
CRM_SUPABASE_ANON_KEY
```

---

## Step 3: Verify CRM Database Access

Let's test if we can access the CRM database. Run this in your terminal:

```bash
curl -X GET "https://mrsmhqgdwjopaspnpohwu.supabase.co/rest/v1/sales_closure?select=email,digital_sale_resume&digital_sale_resume=gt.0&limit=5" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yc21ocWdkd2pvcGFzbnBvaHd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0NDcwNTAsImV4cCI6MjA2NzAyMzA1MH0.gT89NQPLbOQi0B5P0lT6PKqbH-7TMXBmA8IXrGtkT8o" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yc21ocWdkd2pvcGFzbnBvaHd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0NDcwNTAsImV4cCI6MjA2NzAyMzA1MH0.gT89NQPLbOQi0B5P0lT6PKqbH-7TMXBmA8IXrGtkT8o"
```

If successful, you should see JSON data with emails and digital_sale_resume values.

---

## Step 4: Your Complete .env File Structure

Your `.env` file should now look something like this:

```env
# Your Main Supabase Database
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_main_anon_key
VITE_SUPABASE_SERVICE_ROLE_KEY=your_main_service_role_key

# PayPal (if configured)
VITE_PAYPAL_CLIENT_ID=your_paypal_client_id

# CRM Supabase Database (External - Read Only)
CRM_SUPABASE_URL=https://mrsmhqgdwjopaspnpohwu.supabase.co
CRM_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yc21ocWdkd2pvcGFzbnBvaHd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0NDcwNTAsImV4cCI6MjA2NzAyMzA1MH0.gT89NQPLbOQi0B5P0lT6PKqbH-7TMXBmA8IXrGtkT8o
```

---

## Step 5: Restart Your Dev Server

After adding the CRM credentials to `.env`, restart your dev server:

1. Stop the current dev server (Ctrl+C in terminal)
2. Start it again:
```bash
npm run dev
```

---

## ✅ Checklist

- [ ] Added CRM_SUPABASE_URL to .env file
- [ ] Added CRM_SUPABASE_ANON_KEY to .env file
- [ ] Logged into Supabase CLI (`supabase login`)
- [ ] Linked your project (`supabase link`)
- [ ] Set CRM_SUPABASE_URL as secret
- [ ] Set CRM_SUPABASE_ANON_KEY as secret
- [ ] Verified secrets with `supabase secrets list`
- [ ] Tested CRM database access (optional)
- [ ] Restarted dev server

---

## 🔒 Security Notes

✅ **Safe to use:**
- CRM Anon Key (read-only access)
- CRM URL (public information)

❌ **DO NOT commit to Git:**
- Your .env file is already in .gitignore (good!)
- Never share service_role keys publicly

⚠️ **CRM Service Role Key:**
- You provided it, but we don't need it
- We only use the anon key for read-only access
- Keep the service_role key safe and don't use it in our app

---

## 🎯 Next Steps

After completing these steps:

1. Continue with the deployment guide: `STEP_BY_STEP_DEPLOYMENT.md`
2. Start from **STEP 2: Login to Supabase** (you may have already done this)
3. Proceed to **STEP 3: Run Database Migrations**

---

## 🆘 Troubleshooting

### Issue: "supabase: command not found"
**Solution:** Install Supabase CLI:
```bash
npm install -g supabase
```

### Issue: "Project not linked"
**Solution:** Link your project:
```bash
supabase link
```
Then follow the prompts to select your project.

### Issue: Secrets not setting
**Solution:** Make sure you're logged in:
```bash
supabase login
```

### Issue: Cannot access CRM database
**Solution:** Verify the table name is correct:
- Table should be named: `sales_closure`
- Column should be named: `digital_sale_resume`

---

## 📞 Ready to Continue?

Once you've completed all the steps above, you're ready to:

1. Run the database migrations
2. Deploy the edge function
3. Test the sync

Proceed to `STEP_BY_STEP_DEPLOYMENT.md` - **STEP 3: Run Database Migrations**
