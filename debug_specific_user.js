
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function debugUser() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const emailToCheck = "prabhuprabhuchaitanyamolabant2@gmail.com".toLowerCase();

    console.log(`\n🔍 Checking CRM record for: ${emailToCheck}`);
    const { data: crmData, error: crmError } = await supabase
        .from('digital_resume_by_crm')
        .select('*')
        .or(`email.eq.${emailToCheck},company_application_email.eq.${emailToCheck}`);

    if (crmError) {
        console.error("❌ Error fetching CRM data:", crmError.message);
        return;
    }

    if (!crmData || crmData.length === 0) {
        console.log("❌ No CRM record found for this email in either 'email' or 'company_application_email'.");
    } else {
        console.log("✅ CRM Record(s) found:");
        crmData.forEach(row => {
            console.log(`- ID: ${row.id}`);
            console.log(`  Primary Email: ${row.email}`);
            console.log(`  Company Email: ${row.company_application_email}`);
            console.log(`  User ID: ${row.user_id}`);
        });

        const primaryEmail = crmData[0].email;
        console.log(`\n🔍 Checking Auth User for Primary Email: ${primaryEmail}`);
        const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(crmData[0].user_id);

        if (authError) {
            console.log(`- ⚠️ Auth User lookup by ID failed: ${authError.message}`);
            // Try by email
            const { data: authByEmail } = await supabase.auth.admin.listUsers();
            const found = authByEmail.users.find(u => u.email === primaryEmail);
            if (found) {
                console.log(`- ✅ Found Auth User by Email. ID is ${found.id}`);
            } else {
                console.log("- ❌ Auth User NOT found by email either.");
            }
        } else {
            console.log(`- ✅ Auth User found. Email confirmed: ${authUser.user.email_confirmed_at ? "Yes" : "No"}`);
        }
    }
}

debugUser();
