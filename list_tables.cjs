
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
    const { data, error } = await supabase.from('pg_tables').select('tablename').eq('schemaname', 'public');
    // Wait, pg_tables is not accessible via PostgREST usually.
    // I'll try to fetch from some common tables.

    const tables = ['profiles', 'digital_resume_by_crm', 'crm_admins', 'crm_job_requests'];
    for (const table of tables) {
        const { error } = await supabase.from(table).select('*').limit(0);
        if (error) console.log(`Table ${table} Error:`, error.message);
        else console.log(`Table ${table} exists.`);
    }
}
listTables();
