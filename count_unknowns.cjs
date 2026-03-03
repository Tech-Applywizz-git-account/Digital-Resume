const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function countUnknowns() {
    const { data: sessions, error } = await supabase
        .from('resume_sessions')
        .select('country')
        .eq('country', 'Unknown');

    if (error) {
        console.error('Error:', error.message);
        return;
    }

    console.log(`There are currently ${sessions.length} 'Unknown' records in resume_sessions.`);

    const { data: tracking, error: error2 } = await supabase
        .from('resume_click_tracking')
        .select('country')
        .eq('country', 'Unknown');

    if (error2) {
        console.error('Error 2:', error2.message);
    } else {
        console.log(`There are currently ${tracking.length} 'Unknown' records in resume_click_tracking.`);
    }
}

countUnknowns();
