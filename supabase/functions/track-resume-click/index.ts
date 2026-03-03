import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-user-token",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ---------------------------------------------------------------------------
// Country lookup via ipapi.co (AbortController timeout — Deno compatible)
// ---------------------------------------------------------------------------

async function getCountry(req: Request, ip: string): Promise<string> {
    try {
        // 1. Try Supabase/Cloudflare geolocation headers first (fast & reliable)
        // cf-ipcountry is provided by Cloudflare/Supabase and contains the 2-letter ISO code
        const cfCountry = req.headers.get("cf-ipcountry");
        if (cfCountry && cfCountry.length === 2 && !["XX", "T1"].includes(cfCountry.toUpperCase())) {
            const iso = cfCountry.toUpperCase();
            try {
                const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
                const name = displayNames.of(iso);
                if (name) {
                    console.log(`[Geo] Header match: ${iso} -> ${name}`);
                    return name.toUpperCase();
                }
            } catch (e) {
                // Fallback for environments where Intl.DisplayNames might lack data
                const backupMap: Record<string, string> = {
                    'US': 'UNITED STATES', 'IN': 'INDIA', 'GB': 'UNITED KINGDOM',
                    'CA': 'CANADA', 'AU': 'AUSTRALIA', 'DE': 'GERMANY',
                    'FR': 'FRANCE', 'BR': 'BRAZIL', 'CN': 'CHINA', 'JP': 'JAPAN',
                    'AE': 'UNITED ARAB EMIRATES', 'SG': 'SINGAPORE', 'IE': 'IRELAND'
                };
                if (backupMap[iso]) {
                    console.log(`[Geo] Backup map match: ${iso} -> ${backupMap[iso]}`);
                    return backupMap[iso];
                }
            }
            return iso; // Return raw code if we can't translate but it's a valid code
        }

        // 2. Clean up IP and check for local addresses
        if (!ip || ip === "unknown") return "Unknown";
        const cleanIp = ip.split(",")[0].trim();

        const isLocal = cleanIp === "127.0.0.1" ||
            cleanIp === "::1" ||
            cleanIp === "localhost" ||
            cleanIp.startsWith("::ffff:127.0.0.1");

        if (isLocal) {
            console.log(`[Geo] Local IP detected: ${cleanIp}`);
            return "Local (Dev)";
        }

        // 3. Fallback to external providers
        const providers = [
            `https://ip-api.com/json/${cleanIp}`,
            `https://ipapi.co/${cleanIp}/json/`,
            `https://freeipapi.com/api/json/${cleanIp}`
        ];

        for (const url of providers) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 4000);

                const res = await fetch(url, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (!res.ok) continue;
                const data = await res.json();

                // Handle different provider response shapes
                let country = data.country || data.country_name || data.countryName;

                if (country && country.length === 2) {
                    try {
                        const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
                        country = displayNames.of(country.toUpperCase()) || country;
                    } catch (e) { }
                }

                if (country && !["UNKNOWN", "RESERVED"].includes(country.toUpperCase())) {
                    console.log(`[Geo] Provider match (${url}): ${country.toUpperCase()}`);
                    return country.toUpperCase();
                }
            } catch (err) {
                console.log(`[Geo] Failed ${url}:`, err);
                continue;
            }
        }
        return "Unknown";
    } catch (err) {
        console.error("[Geo] General error:", err);
        return "Unknown";
    }
}



// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        let body: Record<string, any>;
        try {
            body = await req.json();
        } catch {
            return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const { resume_id, source, event_type, session_id, duration_seconds } = body;

        if (!resume_id) {
            return new Response(JSON.stringify({ error: "resume_id is required" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Extract IP and user-agent from request headers
        const rawIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
        const ip_address = rawIp.split(",")[0].trim();
        const user_agent = req.headers.get("user-agent") || "unknown";

        // Resolve country from IP
        const country = await getCountry(req, ip_address);

        // Initialize Supabase client
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;

        const supabase = createClient(supabaseUrl, supabaseKey, {
            auth: { persistSession: false },
        });

        const { error } = await supabase
            .from("resume_click_tracking")
            .insert([
                {
                    resume_id,
                    session_id: session_id || null,
                    source: source || "direct",
                    event_type: event_type || "page_load",
                    ip_address,
                    user_agent,
                    country,
                    duration_seconds: duration_seconds || null, // Ensure this column is added via SQL
                },
            ]);

        if (error) {
            console.error("Supabase insert error:", error);
            throw error;
        }

        return new Response(JSON.stringify({ success: true, message: "Tracking recorded" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error) {
        console.error("Function error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
