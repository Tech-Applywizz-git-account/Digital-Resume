
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function testSecondaryLogin() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const primaryEmail = "primary_user_" + Date.now() + "@yopmail.com";
    const secondaryEmail = "company_user_" + Date.now() + "@yopmail.com";
    const password = "TestPassword@123";

    try {
        console.log("1. Creating Primary Auth User...");
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: primaryEmail,
            password: password,
            email_confirm: true
        });
        if (authError) throw authError;
        console.log("✅ Primary user created:", primaryEmail);

        console.log("2. Linking Secondary Email in CRM...");
        const { error: crmError } = await supabase.from('digital_resume_by_crm').insert({
            email: primaryEmail,
            company_application_email: secondaryEmail,
            user_id: authData.user.id,
            is_active: true
        });
        if (crmError) throw crmError;
        console.log("✅ Secondary email linked:", secondaryEmail);

        console.log("\n--- Verification ---");
        console.log("Now trying to login with AUTH (should fail with secondary email naturally)...");
        const { error: failError } = await supabase.auth.signInWithPassword({
            email: secondaryEmail,
            password: password
        });
        console.log("Native Supabase Login with Secondary:", failError ? "❌ Failed (As Expected)" : "✅ Succeeded (Unexpected)");

        console.log("\nIf you were to use my new logic:");
        const { data: lookup } = await supabase
            .from('digital_resume_by_crm')
            .select('email')
            .eq('company_application_email', secondaryEmail)
            .maybeSingle();

        if (lookup?.email) {
            console.log("✅ Lookup found primary email:", lookup.email);
            const { error: successError } = await supabase.auth.signInWithPassword({
                email: lookup.email,
                password: password
            });
            console.log("Login with Primary after lookup:", successError ? "❌ Failed" : "✅ Succeeded!");
        } else {
            console.log("❌ Lookup failed!");
        }

    } catch (err) {
        console.error("❌ Test failed:", err.message);
    }
}

testSecondaryLogin();
