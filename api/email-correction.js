import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

// --- Supabase setup (service role, same pattern as api/server.js) ---
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = (supabaseUrl && supabaseServiceKey)
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null;

function setCors(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Content-Type", "application/json");
}

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v || "");

// Normalize a phone number for comparison: strip everything but digits,
// and drop a leading US/Canada country code ("1") if present, so formats
// like "+1 (555) 123-4567", "555-123-4567", and "15551234567" all compare equal.
function normalizePhone(phone) {
    if (!phone) return "";
    let digits = String(phone).replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("1")) {
        digits = digits.slice(1);
    }
    return digits;
}

// Returns true if the Admin API error indicates the target email is already
// registered to another account. Message text varies across GoTrue versions,
// so we check the error code/status as well as common message substrings.
function isDuplicateEmailError(err) {
    if (!err) return false;
    const code = (err.code || "").toLowerCase();
    const msg = (err.message || "").toLowerCase();
    return (
        code === "email_exists" ||
        err.status === 422 ||
        msg.includes("already been registered") ||
        msg.includes("already exists") ||
        msg.includes("already registered") ||
        msg.includes("already in use")
    );
}

// --- Microsoft Graph email helpers (reused pattern from api/send-credentials.js) ---
async function getMsGraphAccessToken() {
    const tenantId = process.env.VITE_TENANT_ID;
    const clientId = process.env.VITE_CLIENT_ID;
    const clientSecret = process.env.VITE_CLIENT_SECRET;

    if (!tenantId || !clientId || !clientSecret) return null;

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
        console.error("❌ Failed to obtain Microsoft Graph token:", tokenData);
        return null;
    }
    return tokenData.access_token;
}

async function sendGraphMail({ to, subject, html }) {
    const senderEmail = process.env.VITE_SENDER_EMAIL;
    const accessToken = await getMsGraphAccessToken();

    // Mock mode if email isn't configured (mirrors api/send-credentials.js behavior)
    if (!accessToken || !senderEmail) {
        console.log(`⚠️ [MOCK MODE] Email not sent (missing MS Graph config). To: ${to} | Subject: ${subject}`);
        return { ok: true, mock: true };
    }

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
                    subject,
                    body: { contentType: "HTML", content: html },
                    toRecipients: [{ emailAddress: { address: to } }],
                },
                saveToSentItems: false,
            }),
        }
    );

    if (!mailRes.ok) {
        const text = await mailRes.text();
        console.error(`❌ Graph sendMail error (to: ${to}):`, text);
        return { ok: false, error: text };
    }
    return { ok: true };
}

export default async function handler(req, res) {
    setCors(res);

    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST")
        return res.status(405).json({ error: "Method not allowed" });

    if (!supabaseAdmin) {
        console.error("❌ Missing Supabase service role configuration");
        return res.status(500).json({ error: "Server is not configured correctly. Please contact support." });
    }

    // Parse request body.
    // Under Vercel Dev, the request body is already read and parsed into
    // req.body before the handler runs, so re-reading the raw stream returns
    // nothing (Unexpected end of JSON input). In production the body may
    // arrive as a raw stream instead. Handle both cases.
    let body;
    try {
        if (req.body && typeof req.body === "object" && Object.keys(req.body).length > 0) {
            body = req.body;
        } else if (typeof req.body === "string" && req.body.length > 0) {
            body = JSON.parse(req.body);
        } else {
            const chunks = [];
            for await (const chunk of req) chunks.push(chunk);
            const raw = Buffer.concat(chunks).toString();
            body = raw ? JSON.parse(raw) : {};
        }
    } catch (err) {
        return res.status(400).json({ error: "Invalid JSON", details: err.message });
    }

    const awlId = (body.awlId || "").trim();
    const phoneNumber = (body.phoneNumber || "").trim();
    const newEmail = (body.newEmail || "").trim().toLowerCase();

    if (!awlId || !phoneNumber || !newEmail) {
        return res.status(400).json({ error: "AWL ID, Phone Number, and Correct Email Address are all required." });
    }

    if (!isEmail(newEmail)) {
        return res.status(400).json({ error: "Please enter a valid email address." });
    }

    try {
        // Look up the customer by AWL ID first (existing JSON, no schema changes).
        // Phone number is compared in code (below) after normalization, since
        // CRM phone formatting is inconsistent and a raw DB-level string match
        // would miss valid matches like "+1 (555) 123-4567" vs "5551234567".
        const { data: crmRecord, error: crmError } = await supabaseAdmin
            .from("digital_resume_by_crm")
            .select("*")
            .eq("payment_details->crm_data->>lead_id", awlId)
            .maybeSingle();

        if (crmError) {
            console.error("❌ Error looking up CRM record:", crmError);
            return res.status(500).json({ error: "Failed to verify your details. Please try again later." });
        }

        if (!crmRecord || !crmRecord.user_id) {
            return res.status(400).json({
                error: "We couldn't verify your details. Please check your AWL ID and Phone Number and try again.",
            });
        }

        const storedPhone = crmRecord.payment_details?.crm_data?.phone_number || "";
        if (!normalizePhone(storedPhone) || normalizePhone(storedPhone) !== normalizePhone(phoneNumber)) {
            return res.status(400).json({
                error: "We couldn't verify your details. Please check your AWL ID and Phone Number and try again.",
            });
        }

        const userId = crmRecord.user_id;
        const oldEmail = crmRecord.email;

        if (oldEmail && oldEmail.toLowerCase() === newEmail) {
            return res.status(400).json({ error: "This is already your current login email." });
        }

        // Pre-check: digital_resume_by_crm.email is a PRIMARY KEY and profiles.email
        // is expected to be unique. If newEmail already belongs to a different
        // account in either table, updating auth.users first would leave the
        // record in a partially-updated state (auth changed, CRM/profile not).
        // Check both up front and bail out before touching anything.
        const [{ data: conflictingProfile }, { data: conflictingCrmRow }] = await Promise.all([
            supabaseAdmin.from("profiles").select("id").eq("email", newEmail).maybeSingle(),
            supabaseAdmin.from("digital_resume_by_crm").select("user_id").eq("email", newEmail).maybeSingle(),
        ]);

        if (
            (conflictingProfile && conflictingProfile.id !== userId) ||
            (conflictingCrmRow && conflictingCrmRow.user_id !== userId)
        ) {
            return res.status(400).json({ error: "This email address is already in use by another account." });
        }

        // 1. Update auth.users email using the Service Role/Admin API
        const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            email: newEmail,
            email_confirm: true,
        });

        if (authUpdateError) {
            console.error("❌ Failed to update auth.users email:", authUpdateError);
            return res.status(400).json({
                error: isDuplicateEmailError(authUpdateError)
                    ? "This email address is already in use by another account."
                    : "Failed to update your login email. Please contact support.",
            });
        }

        // 2. Update profiles.email
        const { error: profileError } = await supabaseAdmin
            .from("profiles")
            .update({ email: newEmail })
            .eq("id", userId);

        if (profileError) {
            console.error("⚠️ Failed to update profiles.email (auth.users was already updated):", profileError);
        }

        // 3. Update digital_resume_by_crm.email
        // digital_resume_by_crm.email is the PRIMARY KEY of this table, so we
        // match on oldEmail (the exact value already read from crmRecord above)
        // rather than user_id, which may not be reliably populated/typed the
        // same way for every row. .select() lets us confirm a row actually matched.
        const { data: crmUpdateRows, error: crmUpdateError } = await supabaseAdmin
            .from("digital_resume_by_crm")
            .update({ email: newEmail })
            .eq("email", oldEmail)
            .select("email, user_id");

        if (crmUpdateError) {
            console.error("❌ Failed to update digital_resume_by_crm.email:", crmUpdateError);
            return res.status(500).json({
                error: "Your login email was updated, but we couldn't update your CRM record. Please contact support.",
                details: crmUpdateError.message,
            });
        }

        console.log(
            `digital_resume_by_crm update: matched/updated ${crmUpdateRows?.length || 0} row(s) for oldEmail=${oldEmail} -> newEmail=${newEmail}`
        );

        if (!crmUpdateRows || crmUpdateRows.length === 0) {
            console.error(
                `⚠️ digital_resume_by_crm update matched 0 rows. oldEmail=${oldEmail}, user_id=${userId}, awlId=${awlId}`
            );
            return res.status(500).json({
                error: "Your login email was updated, but we couldn't locate your CRM record to update. Please contact support.",
            });
        }

        const updatedAt = new Date().toISOString();

        // 4. Confirmation email to the customer's new email
        await sendGraphMail({
            to: newEmail,
            subject: "Your Digital Resume Login Email Has Been Updated",
            html: `
        <div style="font-family:Arial, sans-serif; line-height:1.6; color:#333; max-width:600px; margin:0 auto; border:1px solid #eee; border-radius:10px; overflow:hidden;">
          <div style="background-color:#0B4F6C; color:white; padding:20px; text-align:center;">
            <h2 style="margin:0;">Login Email Updated</h2>
          </div>
          <div style="padding:30px;">
            <p>Hello,</p>
            <p>Your login email for Digital Resume has been successfully updated.</p>
            <div style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:20px; margin:20px 0;">
              <p style="margin:0;"><strong>New Login Email:</strong> ${newEmail}</p>
            </div>
            <p>Please use your new email address the next time you log in.</p>
            <p>If you did not request this change, please contact our support team immediately.</p>
            <p>Best regards,<br/>Applywizz Team</p>
          </div>
          <div style="background-color:#f1f5f9; color:#64748b; padding:15px; text-align:center; font-size:12px;">
            © ${new Date().getFullYear()} Applywizz. All rights reserved.
          </div>
        </div>
      `,
        });

        // 5. Notification email to admin
        const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || "support@applywizz.com";
        await sendGraphMail({
            to: adminEmail,
            subject: "Email Correction Processed",
            html: `
        <div style="font-family:Arial, sans-serif; line-height:1.6; color:#333;">
          <h2 style="color:#0B4F6C;">Email Correction Request Processed</h2>
          <p><strong>AWL ID:</strong> ${awlId}</p>
          <p><strong>Old Email:</strong> ${oldEmail || "(none on file)"}</p>
          <p><strong>New Email:</strong> ${newEmail}</p>
          <p><strong>Time of Update:</strong> ${updatedAt}</p>
        </div>
      `,
        });

        return res.status(200).json({
            success: true,
            message: "Your email has been updated successfully. Please use your new email to log in.",
        });
    } catch (err) {
        console.error("❌ Error processing email correction:", err);
        return res.status(500).json({ error: "Failed to process your request. Please try again later.", details: err.message });
    }
}