
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

const anonClient = createClient(supabaseUrl, anonKey);

async function run() {
    console.log('--- STARTING ANON CHECK ---');
    const result = await anonClient.from('digital_resume_by_crm').select('*', { count: 'exact', head: true });
    if (result.error) {
        console.log('ANON ERROR:', result.error.message);
    } else {
        console.log('ANON COUNT:', result.count);
    }
}
run();
