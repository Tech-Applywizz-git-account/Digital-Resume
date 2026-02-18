
const { createClient } = require('@supabase/supabase-js');
dotenv = require('dotenv');
dotenv.config();

const client = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkProfiles() {
    const { data, error } = await client.from('profiles').select('*').limit(1);
    if (error) console.log('Profiles Error:', error.message);
    else console.log('Profiles columns:', Object.keys(data[0] || {}));
}
checkProfiles();
