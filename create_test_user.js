
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function createTestUser() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("❌ Missing Supabase keys in .env");
        return;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const email = "harshithamaryala02@gmail.com"; // User requested test email
    const password = "Applywizz@123";
    const fullName = "Harshitha Maryala";

    try {
        console.log(`\n🔄 Step 1: Creating Auth User for ${email}...`);

        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true,
            user_metadata: { full_name: fullName }
        });

        if (authError) throw authError;

        const userId = authData.user.id;
        console.log("✅ Auth user created ID:", userId);

        // Ensure Profile exists (manual insert if trigger is missing)
        console.log(`\n🔄 Step 2: Ensuring Profile exists...`);
        const { error: profileError } = await supabase.from('profiles').upsert({
            id: userId,
            email: email,
            full_name: fullName,
            updated_at: new Date().toISOString()
        });

        if (profileError) {
            console.error("⚠️ Profile upsert warning:", profileError.message);
        } else {
            console.log("✅ Profile ensured.");
        }

        console.log(`\n🔄 Step 3: Adding to digital_resume_by_crm...`);
        const { error: crmError } = await supabase
            .from('digital_resume_by_crm')
            .insert({
                email: email,
                user_id: userId,
                credits_remaining: 4,
                is_active: true,
                added_by: 'System Test Script'
            });

        if (crmError) throw crmError;
        console.log("✅ Added to CRM table.");

        console.log(`\n🔄 Step 4: Initializing Dashboard Stats...`);
        await supabase.from('crm_dashboard_stats').upsert({
            email: email,
            user_id: userId,
            total_applications: 0,
            total_recordings: 0,
            total_resumes: 0,
            total_views: 0
        });
        console.log("✅ Stats initialized.");

        console.log(`\n🔄 Step 5: Sending Credentials Email...`);

        const tenantId = process.env.VITE_TENANT_ID;
        const clientId = process.env.VITE_CLIENT_ID;
        const clientSecret = process.env.VITE_CLIENT_SECRET;
        const senderEmail = process.env.VITE_SENDER_EMAIL;

        const tokenRes = await fetch(
            `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
            {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    client_id: clientId,
                    client_secret: clientSecret,
                    scope: "https://graph.microsoft.com/.default",
                    grant_type: "client_credentials",
                }),
            }
        );
        const tokenData = await tokenRes.json();
        const accessToken = tokenData.access_token;

        const mailRes = await fetch(
            `https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: {
                        subject: "Your Digital Resume CRM Login Credentials",
                        body: {
                            contentType: "HTML",
                            content: `
                                <div style="font-family:Arial, sans-serif; line-height:1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px; overflow: hidden;">
                                  <div style="background-color: #0B4F6C; color: white; padding: 20px; text-align: center;">
                                    <h2 style="margin: 0;">Welcome to Digital Resume CRM</h2>
                                  </div>
                                  <div style="padding: 30px;">
                                    <p>Hello ${fullName},</p>
                                    <p>Your account has been successfully created. Here are your login credentials:</p>
                                    
                                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
                                      <p style="margin: 0 0 10px 0;"><strong>Login Email:</strong> ${email}</p>
                                      <p style="margin: 0;"><strong>Password:</strong> ${password}</p>
                                    </div>

                                    <p>You can login at: <a href="https://digital-resume-bice.vercel.app/auth" style="color: #0B4F6C; font-weight: bold; text-decoration: none;">Digital Resume Dashboard</a></p>
                                    <p>Best regards,<br/>Applywizz Team</p>
                                  </div>
                                </div>
                            `,
                        },
                        toRecipients: [{ emailAddress: { address: email } }],
                    },
                    saveToSentItems: false,
                }),
            }
        );

        if (mailRes.ok) {
            console.log(`🚀 SUCCESS! User ${email} created and credentials email sent.`);
        } else {
            console.error("❌ User created but email failed.");
        }

    } catch (err) {
        console.error("❌ ERROR:", err.message);
    }
}

createTestUser();
