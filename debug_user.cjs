
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://qzzbvgdcnkmjargleluy.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6emJ2Z2RjbmttamFyZ2xlbHV5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTkwODkyMywiZXhwIjoyMDc3NDg0OTIzfQ.9yLMRrYjGJYr_PvOA7-4FADAQ1qzosn2C-16rCsacfM';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function listAll() {
    console.log('Listing all users in auth.users...');
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
        console.error('Error:', authError);
        return;
    }

    console.log(`Total users found: ${users.length}`);
    users.forEach(u => {
        console.log(` - ${u.email} (${u.id})`);
    });

    console.log('\nChecking digital_resume_by_crm table...');
    const { data: crmUsers, error: crmError } = await supabase
        .from('digital_resume_by_crm')
        .select('email, user_id');

    if (crmError) {
        console.error('CRM Error:', crmError);
    } else {
        console.log(`Total CRM records: ${crmUsers.length}`);
        crmUsers.forEach(u => {
            console.log(` - ${u.email} (UID: ${u.user_id})`);
        });
    }
}

listAll();
