const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function resolveIp(ip) {
    if (!ip || ip === 'unknown') return null;
    const cleanIp = ip.split(',')[0].trim();

    // Try multiple providers to ensure resolution
    const providers = [
        `https://ipapi.co/${cleanIp}/json/`,
        `https://ip-api.com/json/${cleanIp}`,
        `https://freeipapi.com/api/json/${cleanIp}`
    ];

    for (const url of providers) {
        try {
            console.log(`Trying ${url}...`);
            const res = await fetch(url);
            if (!res.ok) continue;
            const data = await res.json();

            // Handle different provider response shapes
            const country = data.country_name || data.country || data.countryName;
            if (country && country !== 'Unknown') return country;
        } catch (e) {
            continue;
        }
    }
    return null;
}

async function forceFix() {
    const { data: sessions, error } = await supabase
        .from('resume_sessions')
        .select('ip_address')
        .eq('country', 'Unknown')
        .not('ip_address', 'is', null);

    if (error) return;

    const uniqueIps = [...new Set(sessions.map(s => s.ip_address))];
    console.log(`Found ${uniqueIps.length} IPs to fix.`);

    for (const ip of uniqueIps) {
        const country = await resolveIp(ip);
        if (country) {
            console.log(`✅ ${ip} -> ${country}`);
            await supabase.from('resume_sessions').update({ country }).eq('ip_address', ip);
        } else {
            console.log(`❌ Could not resolve ${ip}`);
        }
        await new Promise(r => setTimeout(r, 1000)); // Rate limit safety
    }
}

forceFix();
