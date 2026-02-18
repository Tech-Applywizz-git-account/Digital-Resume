
const { createClient } = require('@supabase/supabase-js');
dotenv = require('dotenv');
dotenv.config();

const client = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkOrphans() {
    const { data: crmUsers } = await client.from('digital_resume_by_crm').select('user_id');
    const { data: profiles } = await client.from('profiles').select('id');

    const profileIds = new Set(profiles.map(p => p.id));
    const orphans = crmUsers.filter(u => u.user_id && !profileIds.has(u.user_id));

    console.log('Total CRM Users:', crmUsers.length);
    console.log('CRM Users with user_id:', crmUsers.filter(u => u.user_id).length);
    console.log('Orphan user_ids (not in profiles):', orphans.length);
    if (orphans.length > 0) {
        console.log('Sample orphans:', orphans.slice(0, 5));
    }
}
checkOrphans();
