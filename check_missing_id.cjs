const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMissingResumeId() {
    const { count, error } = await supabase
        .from('resume_sessions')
        .select('*', { count: 'exact', head: true })
        .is('resume_id', null);

    if (error) {
        console.error('Error:', error.message);
        return;
    }

    console.log(`Total records in resume_sessions with NULL resume_id: ${count}`);
}

checkMissingResumeId();
