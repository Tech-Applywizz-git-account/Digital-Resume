const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUnknowns() {
    const { data, error } = await supabase
        .from('resume_click_tracking')
        .select('*')
        .ilike('country', '%unknown%');

    if (error) {
        console.error("Error fetching data:", error);
        return;
    }
    console.log(`Found ${data.length} records with unknown country.`);
    for (const row of data.slice(0, 10)) { // show up to 10
        console.log(`ID: ${row.id}, IP: ${row.ip_address}, Country: ${row.country}`);
    }
}

checkUnknowns();
