const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTable() {
    const table = 'resume_click_tracking';
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
        console.log(`Table ${table} Error:`, error.message);
    } else {
        console.log(`Table ${table} exists and has ${data.length} rows.`);
    }
}
checkTable();
