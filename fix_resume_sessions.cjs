const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function getCountry(ip) {
    try {
        if (!ip || ip.toLowerCase() === "unknown" || ip === "127.0.0.1" || ip === "::1" || ip === "localhost") {
            return "Unknown";
        }

        // Handle comma-separated IPs from proxies (take the first one)
        const cleanIp = ip.split(",")[0].trim();

        if (!cleanIp || cleanIp === "127.0.0.1" || cleanIp === "::1") {
            return "Unknown";
        }

        // To avoid SSL issues with some Node.js versions, explicitly try providers
        const providers = [
            `http://ip-api.com/json/${cleanIp}`,
            `https://fullipapi.com/missing`, // fallback
            `https://ipapi.co/${cleanIp}/json/`,
            `https://freeipapi.com/api/json/${cleanIp}`
        ];

        for (const url of providers) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3000);

                const res = await fetch(url, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (!res.ok) continue;
                const data = await res.json();

                // Handle different provider response shapes
                const country = data.country_name || data.country || data.countryName;

                if (country && country !== "Unknown" && country !== "Reserved") {
                    return country;
                }
            } catch (err) {
                // skip
                continue;
            }
        }
        return "Unknown";
    } catch (err) {
        return "Unknown";
    }
}

async function fixSessions() {
    console.log("Fetching resume_sessions with Unknown country...");
    const { data, error } = await supabase.from('resume_sessions').select('id, ip_address, country').or('country.eq.Unknown,country.eq.unknown');

    if (error) {
        console.error("Error fetching sessions:", error);
        return;
    }

    console.log(`Found ${data.length} sessions to fix.`);

    let updatedCount = 0;

    for (let i = 0; i < data.length; i++) {
        const session = data[i];
        if (session.ip_address && session.ip_address.toLowerCase() !== 'unknown') {
            const newCountry = await getCountry(session.ip_address);
            if (newCountry && newCountry.toLowerCase() !== 'unknown') {
                const { error: updateError } = await supabase
                    .from('resume_sessions')
                    .update({ country: newCountry })
                    .eq('id', session.id);

                if (updateError) {
                    console.error(`Error updating session ${session.id}:`, updateError);
                } else {
                    console.log(`[${i + 1}/${data.length}] Updated session ${session.id} (${session.ip_address}) -> ${newCountry}`);
                    updatedCount++;
                }
            } else {
                console.log(`[${i + 1}/${data.length}] Could not resolve IP ${session.ip_address} or it's still Unknown`);
            }
        } else {
            console.log(`[${i + 1}/${data.length}] IP is unknown or empty: ${session.ip_address}`);
        }
        // sleep a bit to avoid rate limits
        await new Promise(r => setTimeout(r, 600));
    }

    console.log(`Finished fixing. Successfully updated ${updatedCount} records.`);
}

fixSessions();
