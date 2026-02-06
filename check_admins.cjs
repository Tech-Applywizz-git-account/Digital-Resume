
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://qzzbvgdcnkmjargleluy.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6emJ2Z2RjbmttamFyZ2xlbHV5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTkwODkyMywiZXhwIjoyMDc3NDg0OTIzfQ.9yLMRrYjGJYr_PvOA7-4FADAQ1qzosn2C-16rCsacfM';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAdmins() {
    console.log('Checking crm_admins table...');
    const { data, error } = await supabase
        .from('crm_admins')
        .select('*');

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Total Admins: ${data.length}`);
    data.forEach(a => {
        console.log(` - ${a.email}`);
    });
}

checkAdmins();
