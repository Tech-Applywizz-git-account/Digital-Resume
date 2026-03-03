const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function countNulls() {
    console.log('--- resume_sessions ---');
    const { data: sNull } = await supabase.from('resume_sessions').select('id').is('country', null);
    const { data: sEmpty } = await supabase.from('resume_sessions').select('id').eq('country', '');
    const { data: sUnknown } = await supabase.from('resume_sessions').select('id').ilike('country', 'unknown');

    console.log(`Nulls: ${sNull?.length || 0}`);
    console.log(`Empty: ${sEmpty?.length || 0}`);
    console.log(`'Unknown' (any case): ${sUnknown?.length || 0}`);

    console.log('\n--- resume_click_tracking ---');
    const { data: tNull } = await supabase.from('resume_click_tracking').select('id').is('country', null);
    const { data: tEmpty } = await supabase.from('resume_click_tracking').select('id').eq('country', '');
    const { data: tUnknown } = await supabase.from('resume_click_tracking').select('id').ilike('country', 'unknown');

    console.log(`Nulls: ${tNull?.length || 0}`);
    console.log(`Empty: ${tEmpty?.length || 0}`);
    console.log(`'Unknown' (any case): ${tUnknown?.length || 0}`);
}

countNulls();
