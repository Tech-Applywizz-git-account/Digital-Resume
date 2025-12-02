# 🔑 Credentials Collection Form

Fill in this form with your credentials before starting deployment.

---

## 1️⃣ Your Main Supabase Project

### Project URL
```
https://_____________________________.supabase.co
```

### Project Reference ID
(The part before .supabase.co)
```
_____________________________
```

### Anon/Public Key
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9._____________________________
```

### Service Role Key ⚠️ (Keep Secret!)
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9._____________________________
```

**Where to find:**
1. Go to https://supabase.com/dashboard
2. Select your project
3. Settings → API
4. Copy the values

---

## 2️⃣ CRM Supabase Database (External)

### CRM Supabase URL
```
https://_____________________________.supabase.co
```

### CRM Anon Key
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9._____________________________
```

### CRM Table Name
```
sales_closure
```

### CRM Column Name
```
digital_sale_resume
```

**Where to get:**
- Ask your CRM database administrator
- OR if you have access, go to CRM Supabase project → Settings → API

---

## 3️⃣ PayPal Credentials (Optional - if not already set)

### PayPal Client ID
```
_____________________________
```

**Where to find:**
- PayPal Developer Dashboard: https://developer.paypal.com/dashboard/
- Apps & Credentials → Your App → Client ID

---

## 4️⃣ Test User Email (from CRM)

### Test Email Address
(An email from your CRM database where digital_sale_resume > 0)
```
_____________________________@_____________
```

This will be used to test the sync and login.

---

## ✅ Checklist

Before proceeding, make sure you have:

- [ ] Main Supabase Project URL
- [ ] Main Supabase Project Reference ID
- [ ] Main Supabase Anon Key
- [ ] Main Supabase Service Role Key
- [ ] CRM Supabase URL
- [ ] CRM Supabase Anon Key
- [ ] CRM table name confirmed (sales_closure)
- [ ] CRM column name confirmed (digital_sale_resume)
- [ ] At least one test email in CRM database
- [ ] PayPal Client ID (if needed)

---

## 📝 Quick Reference Commands

Once you have all credentials, you'll use them in these commands:

### Link Project
```bash
supabase link --project-ref YOUR_PROJECT_REF
```

### Set CRM Credentials
```bash
supabase secrets set CRM_SUPABASE_URL=YOUR_CRM_URL
supabase secrets set CRM_SUPABASE_ANON_KEY=YOUR_CRM_KEY
```

### Deploy Function
```bash
supabase functions deploy sync-crm-users
```

### Test Sync
```bash
supabase functions invoke sync-crm-users --no-verify-jwt
```

---

## 🔒 Security Notes

⚠️ **NEVER share or commit:**
- Service Role Key
- Anon Keys
- PayPal credentials

✅ **Safe to share:**
- Project URL
- Project Reference ID
- Table/column names

---

## 📞 Ready to Start?

Once you've filled in all the credentials above:

1. Save this file
2. Open `STEP_BY_STEP_DEPLOYMENT.md`
3. Follow the steps one by one
4. Use the credentials from this form when needed

Good luck! 🚀
