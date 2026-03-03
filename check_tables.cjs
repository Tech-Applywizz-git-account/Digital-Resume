const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function findTables() {
    // You cannot easily query information_schema.columns via standard supabase-js client without a stored procedure,
    // but we can just use the REST API approach for PostgREST by querying `/?limit=1` maybe? Not easily.
    // Instead we can use a known set of tables or perform an RPC if available.
    // Let me try to ping common tables.
    const tablesToCheck = ['users', 'profiles', 'resume_click_tracking', 'visitors', 'sessions', 'resumes', 'page_views'];
    for (const table of tablesToCheck) {
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (!error && data) {
            console.log(`Table ${table} exists. Columns:`, data[0] ? Object.keys(data[0]) : "empty");
            if (data[0] && Object.keys(data[0]).includes('country')) {
                // query to see if there are any unknowns here
                const res = await supabase.from(table).select('country');
                if (res.data) {
                    const unknowns = res.data.filter(r => (r.country || "").toLowerCase() === "unknown");
                    console.log(` - Found ${unknowns.length} unknowns in ${table}`);
                }
            }
        }
    }
}

findTables();
