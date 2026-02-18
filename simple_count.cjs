
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    try {
        const { count, error } = await supabase.from('digital_resume_by_crm').select('*', { count: 'exact', head: true });
        if (error) console.log('CRM Error:', error.message);
        else console.log('CRM Count:', count);

        const { count: pCount, error: pError } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
        if (pError) console.log('Profile Error:', pError.message);
        else console.log('Profile Count:', pCount);
    } catch (e) {
        console.log('Fatal:', e.message);
    }
}

run();
