
const { createClient } = require('@supabase/supabase-js');
dotenv = require('dotenv');
dotenv.config();

const client = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkAdmins() {
    const { data, error } = await client.from('crm_admins').select('*');
    if (error) console.log('Error:', error.message);
    else console.log('Admins:', data.map(a => a.email));
}
checkAdmins();
