
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY; // Using service role to bypass RLS

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCounts() {
    console.log('Checking table counts...');

    const { count: crmCount, error: crmError } = await supabase
        .from('digital_resume_by_crm')
        .select('*', { count: 'exact', head: true });

    if (crmError) {
        console.error('Error fetching digital_resume_by_crm count:', crmError);
    } else {
        console.log('digital_resume_by_crm count:', crmCount);
    }

    const { count: profileCount, error: profileError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

    if (profileError) {
        console.error('Error fetching profiles count:', profileError);
    } else {
        console.log('profiles count:', profileCount);
    }
}

checkCounts();
