
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    const { data, error } = await supabase.from('digital_resume_by_crm').select('email, user_id').limit(5);
    if (error) console.log('Error:', error.message);
    else console.log('Data:', JSON.stringify(data, null, 2));
}
checkData();
