
// test_email_sending.js
import 'dotenv/config';

async function testEmail() {
    const email = "testing_email_flow@yopmail.com"; // Test recipient
    const password = "TestPassword@123";

    const tenantId = process.env.VITE_TENANT_ID;
    const clientId = process.env.VITE_CLIENT_ID;
    const clientSecret = process.env.VITE_CLIENT_SECRET;
    const senderEmail = process.env.VITE_SENDER_EMAIL;

    console.log("--- Email Configuration ---");
    console.log("Tenant ID:", tenantId ? "Set" : "Missing");
    console.log("Client ID:", clientId ? "Set" : "Missing");
    console.log("Sender Email:", senderEmail);

    if (!tenantId || !clientId || !clientSecret || !senderEmail) {
        console.error("❌ Required environment variables are missing!");
        return;
    }

    try {
        console.log("\n🔄 Requesting Microsoft Graph Access Token...");
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

        if (!tokenData.access_token) {
            console.error("❌ Failed to obtain token:", tokenData);
            return;
        }

        console.log("✅ Access token obtained.");

        console.log(`\n🔄 Sending test email to ${email}...`);
        const mailRes = await fetch(
            `https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${tokenData.access_token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: {
                        subject: "TEST: Digital Resume Email Verification",
                        body: {
                            contentType: "HTML",
                            content: `
                                <div style="font-family:Arial; padding:20px;">
                                    <h2>Test Email Successful</h2>
                                    <p>This is a test to verify the Microsoft Graph email flow is working correctly.</p>
                                    <p><strong>Target Email:</strong> ${email}</p>
                                    <p><strong>Time:</strong> ${new Date().toISOString()}</p>
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
            console.log("🚀 SUCCESS! The email has been sent successfully.");
        } else {
            const errorText = await mailRes.text();
            console.error("❌ FAILED to send email:", errorText);
        }
    } catch (err) {
        console.error("❌ CRITICAL ERROR:", err.message);
    }
}

testEmail();
