const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { count, error } = await supabase
        .from('resume_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('country', 'Unknown');

    if (error) {
        console.error(error);
    } else {
        console.log(`Unknown countries: ${count}`);
    }

    const { data: samples } = await supabase
        .from('resume_sessions')
        .select('ip_address, country')
        .limit(5);
    console.log('Sample records:', samples);
}

check();
