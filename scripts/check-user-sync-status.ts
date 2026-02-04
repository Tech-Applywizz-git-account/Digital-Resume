
import { createClient } from '@supabase/supabase-js';

const CRM_URL = "https://mrsmhqgdwjopasnpohwu.supabase.co";
const CRM_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yc21ocWdkd2pvcGFzbnBvaHd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0NDcwNTAsImV4cCI6MjA2NzAyMzA1MH0.gT89NQPLbOQi0B5P0lT6PKqbH-7TMXBmA8IXrGtkT8o";

const LOCAL_URL = "https://qzzbvgdcnkmjargleluy.supabase.co";
const LOCAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6emJ2Z2RjbmttamFyZ2xlbHV5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTkwODkyMywiZXhwIjoyMDc3NDg0OTIzfQ.9yLMRrYjGJYr_PvOA7-4FADAQ1qzosn2C-16rCsacfM";

const targetEmail = 'venkatavasavi99@gmail.com';

async function diagnose() {
    console.log(`\n🔍 Diagnosing sync status for: ${targetEmail}`);

    const crm = createClient(CRM_URL, CRM_KEY);
    const local = createClient(LOCAL_URL, LOCAL_KEY);

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
                console.log(`Record ${i}:`, JSON.stringify(u, null, 2));
            });
        } else {
            console.log('❌ User NOT FOUND in CRM view "client_digital_resume_view". Checking with wildcard...');
            const { data: fuzzyData } = await crm.from('client_digital_resume_view').select('email').ilike('email', `%${targetEmail.split('@')[0]}%`);
            console.log('Fuzzy matches:', fuzzyData);
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
            console.log('✅ User already exists in local "digital_resume_by_crm" table.');
            console.log('Sync ID:', localData.id);
            console.log('User ID:', localData.user_id);
            console.log('Synced At:', localData.last_sync_at);
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
        const user = authUsers.users.find(u => u.email === targetEmail);
        if (user) {
            console.log('✅ User exists in local Auth system.');
            console.log('Auth ID:', user.id);
        } else {
            console.log('❌ User NOT FOUND in local Auth system.');
        }
    }
}

diagnose();
