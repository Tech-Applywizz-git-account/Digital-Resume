import fetch from "node-fetch";

function setCors(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Content-Type", "application/json");
}

export default async function handler(req, res) {
    setCors(res);

    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST")
        return res.status(405).json({ error: "Method not allowed" });

    // Parse request body
    let body;
    try {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        body = JSON.parse(Buffer.concat(chunks).toString());
    } catch (err) {
        return res.status(400).json({ error: "Invalid JSON", details: err.message });
    }

    const normalizedEmail = (body.email || '').trim().toLowerCase();
    const { password } = body;
    if (!normalizedEmail || !password)
        return res.status(400).json({ error: "Missing required fields: email and password" });

    const email = normalizedEmail; // Use for consistency in template

    // Fetch Microsoft Graph Access Token
    const tenantId = process.env.VITE_TENANT_ID;
    const clientId = process.env.VITE_CLIENT_ID;
    const clientSecret = process.env.VITE_CLIENT_SECRET;
    const senderEmail = process.env.VITE_SENDER_EMAIL;

    // Mock Mode for Local Development if Env Variables are missing
    if (!tenantId || !clientId || !clientSecret || !senderEmail) {
        console.log("⚠️ [MOCK MODE] Email credentials missing in env. Logging email content instead:");
        console.log(`To: ${email}\nCredentials: ${email} / ${password}`);
        return res.status(200).json({
            success: true,
            message: "Credentials logged to server console (Mock Mode)"
        });
    }

    try {
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
        if (!tokenData.access_token)
            throw new Error("Failed to obtain Microsoft Graph token");

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
                    <p>Hello,</p>
                    <p>An administrator has added you to the Digital Resume tool. Here are your login credentials:</p>
                    
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
                      <p style="margin: 0 0 10px 0;"><strong>Login Email:</strong> ${email}</p>
                      <p style="margin: 0;"><strong>Password:</strong> ${password}</p>
                    </div>

                    <p>You can login at: <a href="https://digital-resume-bice.vercel.app/auth" style="color: #0B4F6C; font-weight: bold; text-decoration: none;">Digital Resume Dashboard</a></p>
                    
                    <p style="margin-top: 30px;">For security reasons, we recommend changing your password after your first login.</p>
                    
                    <p>Best regards,<br/>Applywizz Team</p>
                  </div>
                  <div style="background-color: #f1f5f9; color: #64748b; padding: 15px; text-align: center; font-size: 12px;">
                    © ${new Date().getFullYear()} Applywizz. All rights reserved.
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

        if (!mailRes.ok) {
            const text = await mailRes.text();
            throw new Error(`Email send failed: ${text}`);
        }

        return res.status(200).json({
            success: true,
            message: "Credentials email sent successfully",
        });
    } catch (err) {
        console.error("Error sending credentials email:", err);
        return res.status(500).json({ error: "Failed to send email", details: err.message });
    }
}
