
const { createClient } = require('@supabase/supabase-js');

const crmUrl = 'https://mrsmhqgdwjopasnpohwu.supabase.co';
const crmKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yc21ocWdkd2pvcGFzbnBvaHd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0NDcwNTAsImV4cCI6MjA2NzAyMzA1MH0.gT89NQPLbOQi0B5P0lT6PKqbH-7TMXBmA8IXrGtkT8o';

const crm = createClient(crmUrl, crmKey);

async function searchCRM() {
    console.log(`Searching CRM for 'patlolla'...`);

    const { data, error } = await crm
        .from('client_digital_resume_view')
        .select('email')
        .ilike('email', '%patlolla%');

    if (error) {
        console.error('CRM Search Error:', error);
        return;
    }

    console.log('Results:', data);
}

searchCRM();
