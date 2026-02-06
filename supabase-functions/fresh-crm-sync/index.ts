import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// MS365 Email Configuration
const MS365_TENANT_ID = "dd60b066-1b78-4515-84fb-a565c251cb5a";
const MS365_CLIENT_ID = "4116ded8-f37d-4a78-9134-25a39e91bb41";
const MS365_CLIENT_SECRET = "R_c8Q~XSSWy2Tk5GkRbkSURzW1zgKIjI1mjVfcS8";

// Get MS365 Access Token
async function getMS365AccessToken(): Promise<string> {
    const tokenEndpoint = `https://login.microsoftonline.com/${MS365_TENANT_ID}/oauth2/v2.0/token`;
    const params = new URLSearchParams({
        client_id: MS365_CLIENT_ID,
        client_secret: MS365_CLIENT_SECRET,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
    });

    const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
    });

    if (!response.ok) throw new Error(`Failed to get MS365 token: ${response.statusText}`);
    const data = await response.json();
    return data.access_token;
}

// Send welcome email
async function sendWelcomeEmail(email: string, token: string): Promise<boolean> {
    try {
        const response = await fetch('https://graph.microsoft.com/v1.0/users/support@applywizz.com/sendMail', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: {
                    subject: 'Welcome to Digital Resume - Your Account is Ready! 🎉',
                    body: {
                        contentType: 'HTML',
                        content: `
              <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #0B4F6C;">Welcome to Digital Resume!</h2>
                    <p>Hello,</p>
                    <p>Your Digital Resume account has been created successfully! 🎉</p>
                    
                    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                      <h3 style="margin-top: 0;">Your Login Credentials:</h3>
                      <p><strong>Email:</strong> ${email}</p>
                      <p><strong>Password:</strong> Applywizz@123</p>
                      <p><strong>Credits:</strong> 4 Digital Resume Credits</p>
                    </div>
                    
                    <p>You can now create professional digital video resumes and apply to jobs!</p>
                    
                    <p>
                      <a href="https://digital-resume.applywizz.com/auth" style="background-color: #0B4F6C; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">
                        Login Now
                      </a>
                    </p>
                    
                    <p style="margin-top: 30px; color: #666; font-size: 14px;">
                      Best regards,<br>
                      The Digital Resume Team
                    </p>
                  </div>
                </body>
              </html>
            `
                    },
                    toRecipients: [{ emailAddress: { address: email } }]
                }
            })
        });
        return response.ok;
    } catch (error) {
        console.error(`Email error for ${email}:`, error);
        return false;
    }
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        const crmSupabaseUrl = "https://mrsmhqgdwjopasnpohwu.supabase.co";
        const crmSupabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yc21ocWdkd2pvcGFzbnBvaHd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0NDcwNTAsImV4cCI6MjA2NzAyMzA1MH0.gT89NQPLbOQi0B5P0lT6PKqbH-7TMXBmA8IXrGtkT8o";

        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error("Missing Supabase credentials");
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        const crmSupabase = createClient(crmSupabaseUrl, crmSupabaseKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        console.log("🚀 Starting fresh CRM user sync...");

        // STEP 1: Fetch ALL paid users from CRM
        console.log("📥 Fetching users from CRM...");
        const { data: crmUsers, error: crmError } = await crmSupabase
            .from("client_digital_resume_view")
            .select("*")
            .gt("digital_resume_sale_value", 0);

        if (crmError) throw new Error(`CRM fetch error: ${crmError.message}`);

        console.log(`✅ Found ${crmUsers?.length || 0} paid users in CRM`);

        // STEP 2: De-duplicate by email
        const uniqueUsers = new Map();
        (crmUsers || []).forEach(user => {
            if (!uniqueUsers.has(user.email)) {
                uniqueUsers.set(user.email, user);
            }
        });
        const usersToProcess = Array.from(uniqueUsers.values());
        console.log(`📊 Unique users to process: ${usersToProcess.length}`);

        // STEP 3: Get MS365 token once
        let ms365Token: string | null = null;
        try {
            ms365Token = await getMS365AccessToken();
            console.log("✅ MS365 token acquired");
        } catch (e: any) {
            console.error("⚠️  MS365 token failed - emails will be skipped:", e.message);
        }

        // STEP 3b: Load all existing auth users into a map for fast lookup
        console.log("🔐 Loading all auth users for lookup...");
        const authUserMap = new Map<string, string>();
        let page = 1;
        const perPage = 1000;
        let hasMore = true;

        while (hasMore) {
            const { data, error: listError } = await supabase.auth.admin.listUsers({
                page,
                perPage
            });

            if (listError) {
                console.error("❌ Error listing auth users:", listError.message);
                break;
            }

            if (data && data.users) {
                data.users.forEach(u => {
                    if (u.email) authUserMap.set(u.email.toLowerCase(), u.id);
                });

                if (data.users.length < perPage) {
                    hasMore = false;
                } else {
                    page++;
                }
            } else {
                hasMore = false;
            }
        }
        console.log(`✅ Loaded ${authUserMap.size} users from auth for mapping`);

        // STEP 4: Process each user
        const results = {
            total: usersToProcess.length,
            created: 0,
            already_exists: 0,
            errors: 0,
            emails_sent: 0,
            details: [] as any[]
        };

        const BATCH_SIZE = 30; // Process 30 users per run
        let processed = 0;

        for (const crmUser of usersToProcess) {
            if (processed >= BATCH_SIZE) {
                console.log(`⏸️  Batch limit reached (${BATCH_SIZE}). Stopping for this run.`);
                break;
            }

            try {
                const email = crmUser.email;
                console.log(`\n👤 Processing: ${email}`);

                // Check if already synced in our tracking table
                const { data: existing } = await supabase
                    .from("digital_resume_by_crm")
                    .select("user_id")
                    .eq("email", email)
                    .maybeSingle();

                if (existing) {
                    console.log(`   ⏭️  Already synced`);
                    results.already_exists++;
                    continue;
                }

                processed++;

                // Create auth user
                let userId: string | undefined;

                // First check if they are already in our loaded auth map
                if (authUserMap.has(email.toLowerCase())) {
                    userId = authUserMap.get(email.toLowerCase());
                    console.log(`   ♻️  Found existing user in auth map: ${userId}. Resetting password to default.`);

                    // Force password reset to default for synced users
                    const { error: updateError } = await supabase.auth.admin.updateUserById(userId!, {
                        password: "Applywizz@123",
                        email_confirm: true
                    });

                    if (updateError) {
                        console.warn(`   ⚠️  Could not reset password for existing user: ${updateError.message}`);
                    }
                } else {
                    // Try to create if not found in map
                    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
                        email: email,
                        password: "Applywizz@123",
                        email_confirm: true,
                    });

                    if (authError) {
                        if (authError.message.includes("already been registered")) {
                            // If they were created since our initial load, try one last check
                            const { data: lastDitchAttempt } = await supabase.auth.admin.listUsers({
                                page: 1,
                                perPage: 100 // Should find them if recently created
                            });
                            const user = lastDitchAttempt.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
                            if (!user) {
                                throw new Error(`User registered but not found in search: ${email}`);
                            }
                            userId = user.id;
                            console.log(`   ♻️  Using auth ID found via fresh search. Resetting password.`);
                            await supabase.auth.admin.updateUserById(userId, { password: "Applywizz@123", email_confirm: true });
                        } else {
                            throw authError;
                        }
                    } else {
                        userId = authUser.user!.id;
                        console.log(`   ✅ Auth created: ${userId}`);
                    }
                }

                if (!userId) throw new Error("Could not determine user ID");

                // Create/update profile
                await supabase.from("profiles").upsert({
                    id: userId,
                    email: email,
                    credits_remaining: 4,
                    updated_at: new Date().toISOString(),
                }, { onConflict: "id" });
                console.log(`   ✅ Profile created (4 credits)`);

                // Create CRM tracking
                await supabase.from("digital_resume_by_crm").insert({
                    email: email,
                    user_id: userId,
                    credits_remaining: 4,
                    payment_details: {
                        source: "CRM",
                        crm_data: crmUser,
                        synced_at: new Date().toISOString(),
                    },
                    user_created_at: new Date().toISOString(),
                    last_sync_at: new Date().toISOString(),
                    is_active: true,
                });
                console.log(`   ✅ CRM tracking created`);

                // Create dashboard stats
                const { error: statsError } = await supabase.from("crm_dashboard_stats").insert({
                    email: email,
                    user_id: userId,
                    total_applications: 0,
                    total_recordings: 0,
                    total_resumes: 0,
                    total_views: 0,
                    last_login_date: new Date().toISOString(),
                });

                if (statsError) {
                    console.log(`   ⚠️  Dashboard stats skipped: ${statsError.message}`);
                } else {
                    console.log(`   ✅ Dashboard stats created`);
                }

                // Send email
                if (ms365Token) {
                    const emailSent = await sendWelcomeEmail(email, ms365Token);
                    if (emailSent) {
                        console.log(`   ✅ Welcome email sent`);
                        results.emails_sent++;
                    } else {
                        console.log(`   ⚠️  Email failed`);
                    }
                }

                results.created++;
                results.details.push({ email, status: "created", user_id: userId });

            } catch (error: any) {
                console.error(`   ❌ Error: ${error.message}`);
                results.errors++;
                results.details.push({ email: crmUser.email, status: "error", error: error.message });
            }
        }

        console.log("\n📊 Sync Summary:");
        console.log(`   Total in CRM: ${results.total}`);
        console.log(`   Created: ${results.created}`);
        console.log(`   Already Exists: ${results.already_exists}`);
        console.log(`   Errors: ${results.errors}`);
        console.log(`   Emails Sent: ${results.emails_sent}`);

        return new Response(
            JSON.stringify({
                success: true,
                summary: results,
            }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            }
        );
    } catch (error: any) {
        console.error("❌ Fatal error:", error);
        return new Response(
            JSON.stringify({
                success: false,
                error: error.message || "Unknown error occurred",
            }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 400,
            }
        );
    }
});
