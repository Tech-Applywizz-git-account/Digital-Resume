
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

const anonClient = createClient(supabaseUrl, anonKey);

async function run() {
    console.log('--- STARTING ANON CHECK ---');
    const result = await anonClient.from('profiles').select('*', { count: 'exact', head: true });
    if (result.error) {
        console.log('PROFILES ERROR:', result.error.message);
    } else {
        console.log('PROFILES COUNT:', result.count);
    }

    const joinResult = await anonClient
        .from('digital_resume_by_crm')
        .select('*, profiles:user_id(full_name)')
        .limit(1);

    if (joinResult.error) {
        console.log('JOIN ERROR:', joinResult.error.message);
    } else {
        console.log('JOIN SUCCESS, DATA:', JSON.stringify(joinResult.data, null, 2));
    }
}
run();
