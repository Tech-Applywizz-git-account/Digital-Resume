
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://qzzbvgdcnkmjargleluy.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6emJ2Z2RjbmttamFyZ2xlbHV5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTkwODkyMywiZXhwIjoyMDc3NDg0OTIzfQ.9yLMRrYjGJYr_PvOA7-4FADAQ1qzosn2C-16rCsacfM';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function inspectUser() {
    const email = 'sushruthapatlolla15@gmail.com';
    console.log(`Inspecting user: ${email}`);

    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    // Since I know she exists I might need to find her across pages but let's try a direct search if possible
    // listUsers doesn't have a filter, but I can use listUsers with a large perPage or loop

    let targetUser = null;
    let page = 1;
    while (true) {
        const { data: { users } } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
        targetUser = users.find(u => u.email?.toLowerCase() === email);
        if (targetUser || users.length === 0) break;
        page++;
    }

    if (!targetUser) {
        console.log('❌ User not found in exhaustive search');
        return;
    }

    console.log('User Data:', JSON.stringify(targetUser, null, 2));

    // Also check digital_resume_by_crm
    const { data: crmData } = await supabase
        .from('digital_resume_by_crm')
        .select('*')
        .eq('email', email)
        .maybeSingle();

    console.log('CRM Data:', JSON.stringify(crmData, null, 2));
}

inspectUser();
