const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSessions() {
    const { data, error } = await supabase.from('resume_sessions').select('id, country, ip_address');
    if (error) {
        console.error("Error fetching sessions:", error);
        return;
    }
    console.log(`Found ${data.length} sessions.`);

    const unknowns = data.filter(r => !r.country || r.country.toLowerCase() === 'unknown');
    console.log(`Found ${unknowns.length} unknowns in resume_sessions.`);
    let unknownIps = unknowns.filter(u => u.ip_address && u.ip_address.toLowerCase() !== 'unknown');
    console.log(`Found ${unknownIps.length} unknowns WITH a real IP in resume_sessions.`);
}

checkSessions();
