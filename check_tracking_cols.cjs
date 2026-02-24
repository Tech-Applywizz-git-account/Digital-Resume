const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCols() {
    const table = 'resume_click_tracking';
    // Querying the first row to see what columns come back
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
        console.log(`Table ${table} Error:`, error.message);
    } else {
        console.log(`Columns for ${table}:`, Object.keys(data[0] || {}));
    }
}
checkCols();
