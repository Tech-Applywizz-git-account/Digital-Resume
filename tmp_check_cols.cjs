
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkCols() {
    console.log("--- CRM_JOB_REQUESTS ---");
    const { data: crmData } = await supabase.from('crm_job_requests').select('*').limit(1);
    if (crmData && crmData[0]) console.log(Object.keys(crmData[0]));

    console.log("\n--- JOB_REQUESTS ---");
    const { data: regData } = await supabase.from('job_requests').select('*').limit(1);
    if (regData && regData[0]) console.log(Object.keys(regData[0]));

    console.log("\n--- CRM_RECORDINGS ---");
    const { data: crmRec } = await supabase.from('crm_recordings').select('*').limit(1);
    if (crmRec && crmRec[0]) console.log(Object.keys(crmRec[0]));

    console.log("\n--- RECORDINGS ---");
    const { data: regRec } = await supabase.from('recordings').select('*').limit(1);
    if (regRec && regRec[0]) console.log(Object.keys(regRec[0]));
}

checkCols();
