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
        // Add other fields that might be expected
      }];
    } else {
      console.log("Checking for last synced user...");

      // 1. Get the most recent sync timestamp from our local DB
      // We look at the 'crm_data' stored in payment_details to find the original created_at
      const { data: lastSyncRecord } = await supabase
        .from("digital_resume_by_crm")
        .select("payment_details")
        .order("user_created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let lastSyncTime = new Date(0).toISOString(); // Default to 1970 (fetch all) if empty

      // Try to extract the 'created_at' from the stored CRM data
      if (lastSyncRecord?.payment_details?.crm_data?.created_at) {
        lastSyncTime = lastSyncRecord.payment_details.crm_data.created_at;
        console.log(`Last synced user was created at: ${lastSyncTime}`);
      } else {
        console.log("No previous sync data found (or missing created_at). Fetching all.");
      }

      console.log(`Fetching CRM users created AFTER: ${lastSyncTime}`);

      // 2. Fetch only NEW users from CRM view who have PAID (value > 0)
      // We removed 'created_at' check because the column doesn't exist in the view.
      const { data: fetchedUsers, error: crmError } = await crmSupabase
        .from("client_digital_resume_view")
        .select("*")
        .gt("digital_resume_sale_value", 0); // Only Paid Users

      if (crmError) {
        console.error("Error fetching from CRM:", crmError);
        throw new Error(`CRM fetch error: ${crmError.message}`);
      }

      crmUsers = fetchedUsers as CRMUser[];
      console.log(`Found ${crmUsers?.length || 0} PAID CRM users to process`);
    }

    const results: SyncResult[] = [];

    // Process each CRM user
    for (const crmUser of (crmUsers as CRMUser[]) || []) {
      try {
        console.log(`Processing user: ${crmUser.email}`);

        // Check if user already exists in our CRM tracking table
        const { data: existingCRMRecord } = await supabase
          .from("digital_resume_by_crm")
          .select("email, user_id")
          .eq("email", crmUser.email)
          .single();

        if (existingCRMRecord) {
          console.log(`User ${crmUser.email} already exists in CRM tracking, ensuring Auth password is sync...`);
        }

        // Create or get existing auth user
        console.log(`Creating/fetching auth user for ${crmUser.email}`);
        let authUserId: string;

        // Try to create user
        const { data: authUser, error: authError } = await supabase.auth.admin
          .createUser({
            email: crmUser.email,
            password: "Applywizz@123",
            email_confirm: true, // Auto-confirm email
          });

        if (authError) {
          // If user already exists, reset their password
          if (authError.message.includes("already been registered")) {
            console.log(`User ${crmUser.email} already exists in auth, resetting password...`);

            // Fetch and update
            const { data: userData, error: fetchError } = await supabase.auth.admin.listUsers();
            if (fetchError) throw fetchError;

            const existingUser = userData.users.find(u => u.email?.toLowerCase() === crmUser.email.toLowerCase());
            if (!existingUser) throw new Error(`User ${crmUser.email} registered but not found`);

            authUserId = existingUser.id;
            await supabase.auth.admin.updateUserById(authUserId, {
              password: "Applywizz@123",
              email_confirm: true
            });
            console.log(`Password reset for existing user: ${authUserId}`);
          } else {
            console.error(`Auth error for ${crmUser.email}:`, authError);
            throw new Error(`Failed to create auth user: ${authError.message}`);
          }
        } else {
          if (!authUser.user) {
            throw new Error("Auth user creation returned no user");
          }
          authUserId = authUser.user.id;
          console.log(`Auth user created: ${authUserId}`);
        }

        // If user already had a CRM record, we're done with the logic after ensuring auth is fine
        if (existingCRMRecord) {
          results.push({
            email: crmUser.email,
            status: "already_exists",
            user_id: authUserId,
          });
          continue;
        }

        // Create profile with 4 credits
        const { error: profileError } = await supabase
          .from("profiles")
          .upsert({
            id: authUserId,
            email: crmUser.email,
            credits_remaining: 4,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, {
            onConflict: "id",
          });

        if (profileError) {
          console.error(`Profile error for ${crmUser.email}:`, profileError);
          throw new Error(`Failed to create profile: ${profileError.message}`);
        }

        console.log(`Profile created with 4 credits`);

        // Insert into CRM tracking table
        const { error: crmTableError } = await supabase
          .from("digital_resume_by_crm")
          .insert({
            email: crmUser.email,
            user_id: authUserId,
            credits_remaining: 4,
            payment_details: {
              source: "CRM",
              crm_data: crmUser, // Store all columns from the view
              synced_at: new Date().toISOString(),
            },
            user_created_at: new Date().toISOString(),
            last_sync_at: new Date().toISOString(),
            is_active: true,
          });

        if (crmTableError) {
          console.error(`CRM table error for ${crmUser.email}:`, crmTableError);
          throw new Error(
            `Failed to insert into CRM table: ${crmTableError.message}`,
          );
        }

        console.log(`CRM tracking record created`);

        // Create dashboard stats record
        const { error: dashboardStatsError } = await supabase
          .from("crm_dashboard_stats")
          .insert({
            email: crmUser.email,
            user_id: authUserId,
            total_applications: 0,
            total_recordings: 0,
            total_resumes: 0,
            total_views: 0,
            last_login_date: new Date().toISOString(),
          });

        if (dashboardStatsError) {
          console.error(`Dashboard stats error for ${crmUser.email}:`, dashboardStatsError);
          // Don't throw error, just log it - dashboard stats is not critical
          console.warn(`Failed to create dashboard stats, but user was created successfully`);
        } else {
          console.log(`Dashboard stats record created`);
        }

        // Send welcome email using MS365
        try {
          const emailResponse = await fetch('https://graph.microsoft.com/v1.0/users/support@applywizz.com/sendMail', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${await getMS365AccessToken()}`,
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
                          
                          <p>You can now:</p>
                          <ul>
                            <li>Create professional digital video resumes</li>
                            <li>Apply to jobs with your video profile</li>
                            <li>Track your applications</li>
                          </ul>
                          
                          <p>
                            <a href="https://your-app-url.com/auth" style="background-color: #0B4F6C; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">
                              Login Now
                            </a>
                          </p>
                          
                          <p style="margin-top: 30px; color: #666; font-size: 14px;">
                            If you have any questions, please contact our support team.
                          </p>
                          
                          <p style="color: #666; font-size: 14px;">
                            Best regards,<br>
                            The Digital Resume Team
                          </p>
                        </div>
                      </body>
                    </html>
                  `
                },
                toRecipients: [
                  {
                    emailAddress: {
                      address: crmUser.email
                    }
                  }
                ]
              }
            })
          });

          if (emailResponse.ok) {
            console.log(`✅ Welcome email sent to ${crmUser.email}`);
          } else {
            const errorText = await emailResponse.text();
            console.error(`❌ Failed to send email to ${crmUser.email}:`, errorText);
          }
        } catch (emailError: any) {
          console.error(`❌ Email sending error for ${crmUser.email}:`, emailError.message);
          // Don't fail the whole process if email fails
        }

        results.push({
          email: crmUser.email,
          status: "created",
          user_id: authUserId,
        });

        console.log(`Successfully created user ${crmUser.email}`);
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
    const alreadyExists = results.filter((r) => r.status === "already_exists")
      .length;
    const errors = results.filter((r) => r.status === "error").length;

    const summary = {
      total: results.length,
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
