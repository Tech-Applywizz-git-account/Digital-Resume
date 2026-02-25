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

async function getCountry(ip: string): Promise<string> {
    try {
        if (!ip || ip === "unknown" || ip.startsWith("127.") || ip.startsWith("::1")) {
            return "Unknown";
        }
        const cleanIp = ip.split(",")[0].trim();

        const providers = [
            `https://ipapi.co/${cleanIp}/json/`,
            `https://ip-api.com/json/${cleanIp}`
        ];

        for (const url of providers) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3000);

                const res = await fetch(url, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (!res.ok) continue;
                const data = await res.json();
                const country = data.country_name || data.country;

                if (country && country !== "Unknown") return country;
            } catch {
                continue;
            }
        }
        return "Unknown";
    } catch {
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
        const country = await getCountry(ip_address);

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
