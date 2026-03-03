const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectSessions() {
    console.log('Fetching last 10 records from resume_sessions...');
    const { data, error } = await supabase
        .from('resume_sessions')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error fetching data:', error.message);
        return;
    }

    if (!data || data.length === 0) {
        console.log('No records found.');
        return;
    }

    console.table(data.map(row => ({
        id: row.id,
        session_id: row.session_id,
        ip: row.ip_address,
        country: row.country,
        started_at: row.started_at
    })));
}

inspectSessions();
