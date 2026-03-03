const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTotal() {
    const { count, error } = await supabase
        .from('resume_sessions')
        .select('*', { count: 'exact', head: true });

    if (error) {
        console.error('Error:', error.message);
        return;
    }

    console.log(`Total records in resume_sessions: ${count}`);

    // Also check the content of countries
    const { data } = await supabase.from('resume_sessions').select('country');
    const counts = {};
    data.forEach(r => {
        const c = r.country || 'NULL_OR_EMPTY';
        counts[c] = (counts[c] || 0) + 1;
    });
    console.log('Country distribution:', counts);
}

checkTotal();
