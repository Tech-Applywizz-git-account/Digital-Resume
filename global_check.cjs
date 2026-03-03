const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function globalFindUnknown() {
    const commonTables = ['resume_sessions', 'resume_click_tracking', 'visitors', 'sessions', 'page_views'];
    for (const table of commonTables) {
        try {
            const { data, error } = await supabase.from(table).select('*').limit(1);
            if (error || !data || data.length === 0) continue;

            const columns = Object.keys(data[0]);
            if (columns.includes('country')) {
                const { data: unknowns } = await supabase.from(table).select('id').ilike('country', 'unknown');
                console.log(`Table ${table} has ${unknowns?.length || 0} 'Unknown' records.`);

                const { data: nulls } = await supabase.from(table).select('id').is('country', null);
                console.log(`Table ${table} has ${nulls?.length || 0} NULL records.`);
            }
        } catch (e) { }
    }
}

globalFindUnknown();
