const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAll() {
    console.log('Fetching all records...');
    let allData = [];
    let page = 0;
    while (true) {
        const { data, error } = await supabase.from('resume_click_tracking').select('id, ip_address, country').range(page * 1000, (page + 1) * 1000 - 1);
        if (error) {
            console.error("Error fetching data:", error);
            return;
        }
        if (data.length === 0) break;
        allData = allData.concat(data);
        page++;
    }
    console.log(`Found ${allData.length} total records.`);

    // Group by country
    const counts = {};
    const ipExamples = {};
    for (const row of allData) {
        let c = row.country || 'NULL';
        counts[c] = (counts[c] || 0) + 1;
        if (!ipExamples[c]) {
            ipExamples[c] = [];
        }
        if (ipExamples[c].length < 3) {
            ipExamples[c].push(row.ip_address);
        }
    }

    console.log("Country counts:");
    console.log(counts);
    console.log("Examples by country:");
    console.log(ipExamples);
}

checkAll();
