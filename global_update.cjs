
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://qzzbvgdcnkmjargleluy.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6emJ2Z2RjbmttamFyZ2xlbHV5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTkwODkyMywiZXhwIjoyMDc3NDg0OTIzfQ.9yLMRrYjGJYr_PvOA7-4FADAQ1qzosn2C-16rCsacfM';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function globalUpdate() {
    const userId = '259d1907-d977-4a4a-83d7-e50991123241';
    const oldEmail = 'psushruthareddy@gmail.com';
    const newEmail = 'sushruthapatlolla15@gmail.com';

    console.log(`Global Update: ${oldEmail} -> ${newEmail}`);

    // Since there are FKs, we might need to do this carefully.
    // Let's try to update the stats table first (if it's not the PK)

    // 1. Stats
    console.log('Updating stats...');
    await supabase.from('crm_dashboard_stats').update({ email: newEmail }).eq('user_id', userId);

    // 2. CRM Tracking
    console.log('Updating CRM tracking...');
    await supabase.from('digital_resume_by_crm').update({ email: newEmail }).eq('user_id', userId);

    // 3. Profiles
    console.log('Updating profiles...');
    await supabase.from('profiles').update({ email: newEmail }).eq('id', userId);

    // 4. Auth
    console.log('Updating auth...');
    await supabase.auth.admin.updateUserById(userId, { email: newEmail, password: 'Applywizz@123', email_confirm: true });

    console.log('✅ Done.');
}

globalUpdate();
