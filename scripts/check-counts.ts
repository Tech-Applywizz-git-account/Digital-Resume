
import { createClient } from '@supabase/supabase-js';

const CRM_URL = "https://mrsmhqgdwjopasnpohwu.supabase.co";
const CRM_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yc21ocWdkd2pvcGFzbnBvaHd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0NDcwNTAsImV4cCI6MjA2NzAyMzA1MH0.gT89NQPLbOQi0B5P0lT6PKqbH-7TMXBmA8IXrGtkT8o";

async function checkCount() {
    const crm = createClient(CRM_URL, CRM_KEY);
    const { count, error } = await crm
        .from('client_digital_resume_view')
        .select('*', { count: 'exact', head: true })
        .gt('digital_resume_sale_value', 0);

    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log('Total PAID users in CRM:', count);
    }

    // Also check if any other user is synced
    const LOCAL_URL = "https://qzzbvgdcnkmjargleluy.supabase.co";
    const LOCAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6emJ2Z2RjbmttamFyZ2xlbHV5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTkwODkyMywiZXhwIjoyMDc3NDg0OTIzfQ.9yLMRrYjGJYr_PvOA7-4FADAQ1qzosn2C-16rCsacfM";
    const local = createClient(LOCAL_URL, LOCAL_KEY);
    const { count: localCount } = await local
        .from('digital_resume_by_crm')
        .select('*', { count: 'exact', head: true });

    console.log('Total synced users in Local DB:', localCount);
}

checkCount();
