import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, x-user-token",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

function detectDevice(userAgent: string): string {
    return /Mobile/i.test(userAgent) ? "Mobile" : "Desktop";
}

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

serve(async (req: Request) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    // Only allow POST
    if (req.method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, 405);
    }

    // Parse JSON body safely
    let body: {
        resume_id?: unknown;
        session_id?: unknown;
        event_type?: unknown;
        duration_seconds?: unknown;
    };

    try {
        body = await req.json();
    } catch {
        return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const { resume_id, session_id, event_type, duration_seconds } = body;

    // Validate required fields
    if (!resume_id || typeof resume_id !== "string" || resume_id.trim() === "") {
        return jsonResponse({ error: "resume_id is required and must be a non-empty string" }, 400);
    }
    if (!session_id || typeof session_id !== "string" || session_id.trim() === "") {
        return jsonResponse({ error: "session_id is required and must be a non-empty string" }, 400);
    }
    if (!event_type || typeof event_type !== "string") {
        return jsonResponse({ error: "event_type is required" }, 400);
    }

    const ALLOWED_EVENTS = [
        "page_load",
        "play_intro",
        "lets_talk",
        "portfolio_click",
        "pdf_download",
        "session_end",
    ] as const;

    if (!ALLOWED_EVENTS.includes(event_type as (typeof ALLOWED_EVENTS)[number])) {
        return jsonResponse(
            { error: `Invalid event_type. Allowed values: ${ALLOWED_EVENTS.join(", ")}` },
            400
        );
    }

    // Build Supabase client with Service Role Key
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
        return jsonResponse({ error: "Server configuration error" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false },
    });

    try {
        // -----------------------------------------------------------------------
        // 1. page_load — insert new session row (upsert to avoid duplicates)
        // -----------------------------------------------------------------------
        if (event_type === "page_load") {
            const rawIp =
                req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
            const ip_address = rawIp.split(",")[0].trim();
            const userAgent = req.headers.get("user-agent") || "";
            const device = detectDevice(userAgent);
            const country = await getCountry(req, ip_address);

            console.log(`page_load | session=${session_id} | ip=${ip_address} | country=${country} | device=${device}`);

            // Check if session already exists — avoids duplicate rows and 42P10 upsert errors
            const { data: existing, error: selectError } = await supabase
                .from("resume_sessions")
                .select("id, country")
                .eq("session_id", session_id.trim())
                .maybeSingle();

            if (selectError) throw selectError;

            if (!existing) {
                // New session insert
                await supabase.from("resume_sessions").insert({
                    resume_id: resume_id.trim(),
                    session_id: session_id.trim(),
                    ip_address,
                    country,
                    device,
                    video_clicked: false,
                    chat_opened: false,
                    portfolio_clicked: false,
                    pdf_downloaded: false,
                    duration_seconds: 0,
                    started_at: new Date().toISOString(),
                });
            } else if (existing.country === "Unknown" && country !== "Unknown") {
                // Fix "Unknown" if we now have real data
                await supabase
                    .from("resume_sessions")
                    .update({ country })
                    .eq("id", existing.id);
            }


            return jsonResponse({ success: true, event: "page_load", session_id });
        }

        // -----------------------------------------------------------------------
        // 2. play_intro — video_clicked = true
        // -----------------------------------------------------------------------
        if (event_type === "play_intro") {
            const { error } = await supabase
                .from("resume_sessions")
                .update({ video_clicked: true })
                .eq("session_id", session_id.trim());

            if (error) {
                console.error("Supabase update error (play_intro):", error);
                throw error;
            }

            return jsonResponse({ success: true, event: "play_intro", session_id });
        }

        // -----------------------------------------------------------------------
        // 3. lets_talk — chat_opened = true
        // -----------------------------------------------------------------------
        if (event_type === "lets_talk") {
            const { error } = await supabase
                .from("resume_sessions")
                .update({ chat_opened: true })
                .eq("session_id", session_id.trim());

            if (error) {
                console.error("Supabase update error (lets_talk):", error);
                throw error;
            }

            return jsonResponse({ success: true, event: "lets_talk", session_id });
        }

        // -----------------------------------------------------------------------
        // 4. portfolio_click — portfolio_clicked = true
        // -----------------------------------------------------------------------
        if (event_type === "portfolio_click") {
            const { error } = await supabase
                .from("resume_sessions")
                .update({ portfolio_clicked: true })
                .eq("session_id", session_id.trim());

            if (error) {
                console.error("Supabase update error (portfolio_click):", error);
                throw error;
            }

            return jsonResponse({ success: true, event: "portfolio_click", session_id });
        }

        // -----------------------------------------------------------------------
        // 5. pdf_download — pdf_downloaded = true
        // -----------------------------------------------------------------------
        if (event_type === "pdf_download") {
            const { error } = await supabase
                .from("resume_sessions")
                .update({ pdf_downloaded: true })
                .eq("session_id", session_id.trim());

            if (error) {
                console.error("Supabase update error (pdf_download):", error);
                throw error;
            }

            return jsonResponse({ success: true, event: "pdf_download", session_id });
        }

        // -----------------------------------------------------------------------
        // 6. session_end — duration_seconds + ended_at
        // -----------------------------------------------------------------------
        if (event_type === "session_end") {
            const durationVal =
                typeof duration_seconds === "number" && Number.isFinite(duration_seconds) && duration_seconds >= 0
                    ? Math.round(duration_seconds)
                    : 0;

            const { error } = await supabase
                .from("resume_sessions")
                .update({
                    duration_seconds: durationVal,
                    ended_at: new Date().toISOString(),
                })
                .eq("session_id", session_id.trim());

            if (error) {
                console.error("Supabase update error (session_end):", error);
                throw error;
            }

            return jsonResponse({ success: true, event: "session_end", session_id, duration_seconds: durationVal });
        }

        // Should never reach here because of the ALLOWED_EVENTS guard above
        return jsonResponse({ error: "Unhandled event_type" }, 400);

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Internal server error";
        console.error("Function error:", err);
        return jsonResponse({ error: message }, 500);
    }
});
