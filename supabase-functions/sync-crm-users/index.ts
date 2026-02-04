import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CRMUser {
  email: string;
  resume_sale_value?: number;
  [key: string]: any; // Allow any other columns from the view
}

interface SyncResult {
  email: string;
  status: "created" | "already_exists" | "error";
  user_id?: string;
  error?: string;
}

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
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(`Failed to get MS365 access token: ${response.statusText}`);
  }

  const data = await response.json();
  return data.access_token;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get environment variables for main Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    // Hardcoded CRM database credentials
    const crmSupabaseUrl = "https://mrsmhqgdwjopasnpohwu.supabase.co";
    const crmSupabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yc21ocWdkd2pvcGFzbnBvaHd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0NDcwNTAsImV4cCI6MjA2NzAyMzA1MH0.gT89NQPLbOQi0B5P0lT6PKqbH-7TMXBmA8IXrGtkT8o";

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase credentials");
    }

    // Initialize Supabase clients
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const crmSupabase = createClient(crmSupabaseUrl, crmSupabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Check for manual creation request
    let reqBody: any = {};
    try {
      reqBody = await req.json();
    } catch (e) {
      // Body might be empty for cron jobs
    }

    const { action, email, name } = reqBody;
    let crmUsers: CRMUser[] = [];

    if (action === 'manual_create') {
      if (!email) throw new Error("Email is required for manual creation");
      console.log(`Manual creation requested for ${email}`);

      // Create a mock CRM user object
      crmUsers = [{
        email: email,
        digital_resume_sale_value: 999, // Ensure it passes any checks
        full_name: name || "Manual User",
      }];
    } else {
      console.log("Fetching CRM users...");

      // Fetch only users from CRM view who have PAID (value > 0)
      const { data: fetchedUsers, error: crmError } = await crmSupabase
        .from("client_digital_resume_view")
        .select("*")
        .gt("digital_resume_sale_value", 0);

      if (crmError) {
        console.error("Error fetching from CRM:", crmError);
        throw new Error(`CRM fetch error: ${crmError.message}`);
      }

      const allFetched = (fetchedUsers as CRMUser[]) || [];
      console.log(`Found ${allFetched.length} total PAID CRM records`);

      // De-duplicate by email in memory
      const uniqueUsersMap = new Map<string, CRMUser>();
      allFetched.forEach(user => {
        if (!uniqueUsersMap.has(user.email)) {
          uniqueUsersMap.set(user.email, user);
        }
      });
      crmUsers = Array.from(uniqueUsersMap.values());
      console.log(`Unique PAID users to process: ${crmUsers.length}`);
    }

    const results: SyncResult[] = [];
    let processedCount = 0;
    const MAX_NEW_USERS_PER_RUN = 40;

    // Get MS365 Token ONCE at the start
    let ms365Token: string | null = null;
    try {
      ms365Token = await getMS365AccessToken();
      console.log("MS365 Token acquired successfully");
    } catch (e: any) {
      console.error("Failed to acquire MS365 token - welcome emails will not be sent:", e.message);
    }

    // Process each CRM user
    for (const crmUser of crmUsers) {
      try {
        console.log(`Checking user: ${crmUser.email}`);

        // Check if user already exists in our CRM tracking table
        const { data: existingCRMRecord } = await supabase
          .from("digital_resume_by_crm")
          .select("email, user_id")
          .eq("email", crmUser.email)
          .maybeSingle();

        if (existingCRMRecord) {
          if (action === 'manual_create') {
            console.log(`Manual request: user ${crmUser.email} already exists.`);
            results.push({
              email: crmUser.email,
              status: "already_exists",
              user_id: existingCRMRecord.user_id,
            });
          }
          continue; // Skip already exists in bulk run without logging to save time
        }

        // Limit check for bulk sync
        if (processedCount >= MAX_NEW_USERS_PER_RUN && action !== 'manual_create') {
          console.log(`Reached max batch limit (${MAX_NEW_USERS_PER_RUN}). Stopping for this run.`);
          break;
        }
        processedCount++;

        console.log(`Processing NEW user: ${crmUser.email}`);

        // Create or get existing auth user
        let authUserId: string;

        // Try to create user
        const { data: authUser, error: authError } = await supabase.auth.admin
          .createUser({
            email: crmUser.email,
            password: "Applywizz@123",
            email_confirm: true,
          });

        if (authError) {
          // If user already exists in Auth, fetch their ID
          if (authError.message.includes("already been registered")) {
            console.log(`User ${crmUser.email} exists in auth, linking...`);
            const { data: existingUsers } = await supabase.auth.admin.listUsers();
            const existingUser = existingUsers.users.find(u => u.email === crmUser.email);

            if (!existingUser) throw new Error(`User exists but not found in list`);
            authUserId = existingUser.id;
          } else {
            throw authError;
          }
        } else {
          if (!authUser.user) throw new Error("Auth user creation returned no user");
          authUserId = authUser.user.id;
        }

        // Create/Update profile
        await supabase.from("profiles").upsert({
          id: authUserId,
          email: crmUser.email,
          credits_remaining: 4,
          updated_at: new Date().toISOString(),
        }, { onConflict: "id" });

        // Insert into CRM tracking table
        await supabase.from("digital_resume_by_crm").insert({
          email: crmUser.email,
          user_id: authUserId,
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

        // Create dashboard stats record
        await supabase.from("crm_dashboard_stats").insert({
          email: crmUser.email,
          user_id: authUserId,
          total_applications: 0,
          total_recordings: 0,
          total_resumes: 0,
          total_views: 0,
          last_login_date: new Date().toISOString(),
        }).catch(e => console.warn("Dashboard stats failed (non-critical)"));

        // Send welcome email using MS365
        if (ms365Token) {
          try {
            await fetch('https://graph.microsoft.com/v1.0/users/support@applywizz.com/sendMail', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${ms365Token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                message: {
                  subject: 'Welcome to Digital Resume - Your Account is Ready!',
                  body: {
                    contentType: 'HTML',
                    content: `
                      <html>
                        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                            <h2 style="color: #0B4F6C;">Welcome to Digital Resume!</h2>
                            <p>Hello,</p>
                            <p>Your Digital Resume account has been created successfully!</p>
                            
                            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                              <h3 style="margin-top: 0;">Your Login Credentials:</h3>
                              <p><strong>Email:</strong> ${crmUser.email}</p>
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
                  toRecipients: [{ emailAddress: { address: crmUser.email } }]
                }
              })
            });
            console.log(`✅ Welcome email sent to ${crmUser.email}`);
          } catch (emailError: any) {
            console.error(`❌ Email error for ${crmUser.email}:`, emailError.message);
          }
        }

        results.push({
          email: crmUser.email,
          status: "created",
          user_id: authUserId,
        });

      } catch (error: any) {
        console.error(`Error processing ${crmUser.email}:`, error);
        results.push({
          email: crmUser.email,
          status: "error",
          error: error.message || "Unknown error",
        });
      }
    }

    // Summary
    const created = results.filter((r) => r.status === "created").length;
    const alreadyExists = results.filter((r) => r.status === "already_exists").length;
    const errors = results.filter((r) => r.status === "error").length;

    const summary = {
      total_attempted: processedCount,
      created,
      alreadyExists,
      errors,
    };

    console.log("Sync completed:", summary);

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error: any) {
    console.error("Fatal error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Unknown error occurred",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      },
    );
  }
});
