const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data, error } = await supabase.from('digital_resume_by_crm').select('*').limit(1);
    if (error) {
        console.error(error);
        return;
    }
    const row = data[0];
    console.log("Keys:", Object.keys(row));
    console.log("company_application_email:", row.company_application_email);
    console.log("email:", row.email);
    if (row.crm_data) {
        console.log("crm_data types:", typeof row.crm_data);
        console.log("crm_data keys:", Object.keys(row.crm_data));
    }
}

check();
