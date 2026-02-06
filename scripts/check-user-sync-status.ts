
import { createClient } from '@supabase/supabase-js';

const CRM_URL = "https://mrsmhqgdwjopasnpohwu.supabase.co";
const CRM_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yc21ocWdkd2pvcGFzbnBvaHd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0NDcwNTAsImV4cCI6MjA2NzAyMzA1MH0.gT89NQPLbOQi0B5P0lT6PKqbH-7TMXBmA8IXrGtkT8o";

const LOCAL_URL = "https://qzzbvgdcnkmjargleluy.supabase.co";
const LOCAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6emJ2Z2RjbmttamFyZ2xlbHV5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTkwODkyMywiZXhwIjoyMDc3NDg0OTIzfQ.9yLMRrYjGJYr_PvOA7-4FADAQ1qzosn2C-16rCsacfM";

const targetEmails = ['venkatavasavi99@gmail.com', 'Sushruthapatlolla15@gmail.com'];

async function diagnose() {
    const crm = createClient(CRM_URL, CRM_KEY);
    const local = createClient(LOCAL_URL, LOCAL_KEY);

    for (const targetEmail of targetEmails) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`🔍 Diagnosing: ${targetEmail}`);
        console.log('='.repeat(60));

        // 1. Check CRM
        console.log(`\n--- CRM Check ---`);
        const { data: crmData, error: crmError } = await crm
            .from('client_digital_resume_view')
            .select('*')
            .eq('email', targetEmail);

        if (crmError) {
            console.error('❌ Error fetching from CRM:', crmError.message);
        } else {
            if (crmData && crmData.length > 0) {
                console.log(`✅ ${crmData.length} records found in CRM for this email.`);
                crmData.forEach((u, i) => {
                    console.log(`\nRecord ${i}:`);
                    console.log(`  Lead ID: ${u.lead_id}`);
                    console.log(`  Name: ${u.lead_name}`);
                    console.log(`  Email: ${u.email}`);
                    console.log(`  Digital Resume Sale Value: ${u.digital_resume_sale_value}`);
                    console.log(`  Resume Sale Value: ${u.resume_sale_value}`);

                    if (u.digital_resume_sale_value > 0) {
                        console.log(`  ✅ ELIGIBLE for sync (digital_resume_sale_value > 0)`);
                    } else {
                        console.log(`  ❌ NOT ELIGIBLE (digital_resume_sale_value is ${u.digital_resume_sale_value})`);
                    }
                });
            } else {
                console.log('❌ User NOT FOUND in CRM view "client_digital_resume_view".');
            }
        }

        // 2. Check Local DB
        console.log(`\n--- Local DB Check (digital_resume_by_crm) ---`);
        const { data: localData, error: localError } = await local
            .from('digital_resume_by_crm')
            .select('*')
            .eq('email', targetEmail)
            .maybeSingle();

        if (localError) {
            console.error('❌ Error fetching from local DB:', localError.message);
        } else {
            if (localData) {
                console.log('✅ User EXISTS in local "digital_resume_by_crm" table.');
                console.log('  Sync ID:', localData.id);
                console.log('  User ID:', localData.user_id);
                console.log('  Credits:', localData.credits_remaining);
                console.log('  Synced At:', localData.last_sync_at);
            } else {
                console.log('❌ User NOT FOUND in local "digital_resume_by_crm" table.');
            }
        }

        // 3. Check Auth
        console.log(`\n--- Local Auth Check ---`);
        const { data: authUsers, error: authError } = await local.auth.admin.listUsers();

        if (authError) {
            console.error('❌ Error listing auth users:', authError.message);
        } else {
            const user = authUsers.users.find(u => u.email?.toLowerCase() === targetEmail.toLowerCase());
            if (user) {
                console.log('✅ User EXISTS in local Auth system.');
                console.log('  Auth ID:', user.id);
                console.log('  Email:', user.email);
                console.log('  Email Confirmed:', user.email_confirmed_at ? 'YES' : 'NO');
                console.log('  Created At:', user.created_at);
            } else {
                console.log('❌ User NOT FOUND in local Auth system.');
            }
        }

        // 4. Check Profiles
        console.log(`\n--- Profile Check ---`);
        const { data: profileData, error: profileError } = await local
            .from('profiles')
            .select('*')
            .eq('email', targetEmail)
            .maybeSingle();

        if (profileError) {
            console.error('❌ Error fetching profile:', profileError.message);
        } else {
            if (profileData) {
                console.log('✅ Profile EXISTS.');
                console.log('  Profile ID:', profileData.id);
                console.log('  Credits:', profileData.credits_remaining);
            } else {
                console.log('❌ Profile NOT FOUND.');
            }
        }
    }
}

diagnose();
