import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-user-token",
};

serve(async (req) => {
    console.log(`[${new Date().toISOString()}] Incoming request: ${req.method}`);

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const body = await req.json();
        const { resume_id, source } = body;
        console.log("Request body:", body);

        if (!resume_id) {
            console.error("Missing resume_id in request");
            return new Response(JSON.stringify({ error: "resume_id is required" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const ip_address = req.headers.get("x-forwarded-for") || "unknown";
        const user_agent = req.headers.get("user-agent") || "unknown";

        // Initialize Supabase client
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        // Fallback to ANON_KEY if SERVICE_ROLE_KEY is not set (requires RLS policy)
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;

        console.log(`Using key type: ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ? 'SERVICE_ROLE' : 'ANON'}`);

        const supabase = createClient(supabaseUrl, supabaseKey, {
            auth: { persistSession: false },
        });

        const { data, error } = await supabase
            .from("resume_click_tracking")
            .insert([
                {
                    resume_id,
                    source: source || "direct",
                    ip_address,
                    user_agent,
                },
            ]);

        if (error) {
            console.error("Supabase insert error:", error);
            throw error;
        }

        console.log("Tracking recorded successfully");
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
