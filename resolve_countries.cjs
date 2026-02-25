const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing environment variables.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function getCountry(ip) {
    try {
        if (!ip || ip === 'unknown' || ip === '127.0.0.1' || ip === '::1') return 'Local/Unknown';
        const res = await fetch(`https://ipapi.co/${ip}/json/`);
        if (!res.ok) return 'Unknown';
        const data = await res.json();
        return data.country_name || 'Unknown';
    } catch (e) {
        return 'Unknown';
    }
}

async function fixCountries() {
    console.log("🔍 Fetching sessions with Unknown country...");

    // 1. Get unique IPs that need resolving
    const { data: sessions, error } = await supabase
        .from('resume_sessions')
        .select('ip_address')
        .or('country.eq.Unknown,country.is.null')
        .not('ip_address', 'is', null);

    if (error) {
        console.error("Error fetching data:", error);
        return;
    }

    const uniqueIps = [...new Set(sessions.map(s => s.ip_address))];
    console.log(`📡 Found ${uniqueIps.length} unique IPs to resolve.`);

    for (const ip of uniqueIps) {
        process.stdout.write(`Resolving ${ip}... `);
        const country = await getCountry(ip);
        console.log(country);

        if (country && country !== 'Unknown') {
            const { error: updateError } = await supabase
                .from('resume_sessions')
                .update({ country })
                .eq('ip_address', ip);

            if (updateError) console.error(`Failed to update ${ip}:`, updateError.message);
        }

        // Tiny delay to respect rate limits
        await new Promise(r => setTimeout(r, 500));
    }

    console.log("✅ Finished resolving countries.");
}

fixCountries();
