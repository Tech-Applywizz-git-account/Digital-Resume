const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

const userId = '29829554-0694-403c-ad45-29f3b83f6e64';

(async () => {
    console.log('=== A. profiles ===');
    const { data: profiles } = await supabase.from('profiles').select('id, email, tier, first_name, full_name').eq('id', userId).maybeSingle();
    console.log(JSON.stringify(profiles, null, 2));

    console.log('\n=== B. crm_job_requests (by user_id) ===');
    const { data: crmJobs } = await supabase.from('crm_job_requests').select('id, user_id, email, job_title, resume_url').eq('user_id', userId).limit(5);
    console.log(JSON.stringify(crmJobs, null, 2));

    console.log('\n=== C. job_requests (by user_id) ===');
    const { data: regJobs } = await supabase.from('job_requests').select('id, user_id, email, job_title, resume_path').eq('user_id', userId).limit(5);
    console.log(JSON.stringify(regJobs, null, 2));

    console.log('\n=== D. profiles.career_identity_data ===');
    const { data: profileWithCi } = await supabase.from('profiles').select('id, email, career_identity_data').eq('id', userId).maybeSingle();
    console.log(JSON.stringify(profileWithCi, null, 2));

    console.log('\n=== E. career_identity_themes ===');
    const { data: themes } = await supabase.from('career_identity_themes').select('*').limit(10);
    console.log(JSON.stringify(themes, null, 2));
})();