import { createClient } from "@supabase/supabase-js";
import { AzureOpenAI } from "openai";
import { logAzureUsage } from "./utils/tokenLogger.js";

export default async function handler(req, res) {
  // --- CORS headers ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type");
  res.setHeader("Content-Type", "application/json");

  // --- Handle CORS preflight request ---
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // --- Allow only POST ---
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const azureOpenAiApiKey = process.env.AZURE_OPENAI_API_KEY;
    const azureOpenAiEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const azureOpenAiApiVersion = process.env.AZURE_OPENAI_API_VERSION;
    const azureOpenAiDeployment = process.env.AZURE_OPENAI_DEPLOYMENT;
    const azureMaxTokens = process.env.AZURE_MAX_TOKENS ? parseInt(process.env.AZURE_MAX_TOKENS, 10) : 800;

    const missingAzureConfig = [
      !azureOpenAiApiKey && "AZURE_OPENAI_API_KEY",
      !azureOpenAiEndpoint && "AZURE_OPENAI_ENDPOINT",
      !azureOpenAiApiVersion && "AZURE_OPENAI_API_VERSION",
      !azureOpenAiDeployment && "AZURE_OPENAI_DEPLOYMENT",
    ].filter(Boolean);

    if (missingAzureConfig.length > 0) {
      console.error("Missing Azure OpenAI configuration:", missingAzureConfig);
      return res.status(500).json({
        error: "Azure OpenAI is not configured on the server.",
        missing: missingAzureConfig,
      });
    }

    const openai = new AzureOpenAI({
      endpoint: azureOpenAiEndpoint,
      apiKey: azureOpenAiApiKey,
      apiVersion: azureOpenAiApiVersion,
      deployment: azureOpenAiDeployment,
    });

    // --- Parse JSON body ---
    let body;
    if (req.body && typeof req.body === 'object') {
      body = req.body;
    } else {
      try {
        const buffers = [];
        for await (const chunk of req) buffers.push(chunk);
        const rawBody = Buffer.concat(buffers).toString();
        body = JSON.parse(rawBody);
      } catch (err) {
        return res.status(400).json({ error: "Invalid request body" });
      }
    }

    const { resumeText, messages, question, recruiterMode, ownerId, ownerEmail: ownerEmailFromBody } = body;

    if (!resumeText || !question) {
      return res.status(400).json({ error: "Missing resumeText or question in request body" });
    }

    console.log(`📥 resume-chat: ownerId=${ownerId || 'null'}, ownerEmail=${ownerEmailFromBody || 'null'}, recruiterMode=${!!recruiterMode}`);

    // --- Resolve user_id for token logging ---
    // Primary:  ownerId sent by frontend (resolved from Supabase DB on UUID-based pages)
    // Fallback: look up user_id via ownerEmail in digital_resume_by_crm
    //           (covers slug-based pages like ?resumeId=profile where ownerId is null)
    let user_id = ownerId || null;

    if (!user_id && ownerEmailFromBody) {
      try {
        const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (supabaseUrl && supabaseServiceKey) {
          const { createClient } = await import("@supabase/supabase-js");
          const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
          const { data: crmUser } = await supabaseAdmin
            .from('digital_resume_by_crm')
            .select('user_id')
            .eq('email', ownerEmailFromBody.trim().toLowerCase())
            .maybeSingle();
          if (crmUser?.user_id) {
            user_id = crmUser.user_id;
            console.log(`✅ resume-chat: Resolved user_id via ownerEmail fallback: ${user_id}`);
          } else {
            console.warn(`⚠️ resume-chat: No CRM record found for ownerEmail="${ownerEmailFromBody}". Token usage will NOT be logged.`);
          }
        }
      } catch (lookupErr) {
        console.error("❌ resume-chat: Email→user_id fallback lookup failed:", lookupErr?.message);
      }
    }

    // Build the system prompt based on mode
    let systemPrompt;

    if (recruiterMode) {
      systemPrompt = `You ARE the person described in this resume. You are responding to a recruiter or hiring manager who is viewing your portfolio and wants to learn more about you.
            
NAME OF CANDIDATE (You): 
[Extract the name from the resume text provided below]

RESUME (your background):
-------------------
${resumeText.slice(0, 25000)}
-------------------

CRITICAL RULES:
1. **Always respond in FIRST PERSON** — "I have experience in...", "My role at...", "I built...", etc.
2. **Your Identity** — If someone asks "Who are you?", "What is your name?", or "What is my name?" (often asked by users testing your AI), you must identify yourself as the candidate whose resume this is. Say "My name is [Name]" or "I am [Name]". DO NOT say "Your name is [Name]" to the user.
3. **Professional & Confident Tone** — Speak like a top candidate who knows their worth. Be articulate, direct, and confident without being arrogant.
4. **Recruiter-Friendly** — Assume the person asking is a recruiter or hiring manager. Tailor responses to demonstrate value, impact, and fit.
5. **Slightly Playful for Personal Questions** — If asked fun/casual questions (hobbies, fun facts, etc.), be warm, personable, and add a touch of personality. Keep it professional but human.
6. **Contact Details** — If asked how to reach you, provide the email, phone, LinkedIn, or other contact info EXACTLY as listed on the resume. Do NOT fabricate contact info.
7. **No Hallucinations** — Only reference skills, roles, projects, and experiences that appear in the resume. Never make up information.
8. **Quantify Impact** — When discussing achievements, mention specific metrics, numbers, or outcomes if they appear in the resume.
9. **Format** — Use Markdown formatting. Use bullet points for lists. Keep responses concise but thorough.
10. **Follow-up Suggestions**: At the very end of your response, strictly output a line starting with "SUGGESTED_QUESTIONS:" followed by 3 short, relevant follow-up questions separated by a pipe character "|".

Example responses:
- Q: "Tell me about yourself" → "I'm a [role] with [X] years of experience in [domains]. Currently, I [current/recent role]. I'm passionate about [key areas]..."
- Q: "What is your name?" → "My name is [Name]. It's great to meet you!"
- Q: "What is my name?" → "I'm not sure what your name is, but I'm [Name], and I'm here to answer any questions about my background."
- Q: "What are your strengths?" → "My core strengths lie in [skills]. In my recent role at [company], I [specific achievement with metrics]..."
- Q: "Can I contact you?" → "Absolutely! You can reach me at [email] or connect with me on LinkedIn at [URL]."

Example end of response:
SUGGESTED_QUESTIONS: What was your biggest project?|What tech stack do you prefer?|Are you open to relocation?`;
    } else {
      systemPrompt = `You are a helpful AI assistant analyzing a resume.

CONTEXT:
- The user is asking questions about the resume provided below.
- The user may refer to "this company", "it", or use pronouns based on previous messages.
- The text provided is raw extraction from a PDF.

RESUME TEXT:
-------------------
${resumeText.slice(0, 25000)}
-------------------

INSTRUCTIONS:
1. **Identify the Candidate**: The name constitutes the header/title of the resume. If asked "What is my name?" or "Who is this?", look for the most prominent name at the start of the text.
2. **Be Helpful & Context Aware**: Answer questions directly using the resume content. Use previous conversation context to resolve references like "where is it located?".
3. **No Hallucinations**: Do not invent skills or jobs. Use only what is written.
4. **Format**: Use Markdown. Use bullet points for lists.
5. **Follow-up Suggestions**: At the very end of your response, strictly output a line starting with "SUGGESTED_QUESTIONS:" followed by 3 short, relevant follow-up questions separated by a pipe character "|".
Example end of response:
...matches your requirements.
SUGGESTED_QUESTIONS: What is their education?|Do they know Python?|Years of experience?`;
    }

    // Construct the conversation history
    const conversationMessages = [
      {
        role: "system",
        content: systemPrompt
      }
    ];

    // Add valid history (limit to last 6 messages to save tokens)
    if (messages && Array.isArray(messages)) {
      messages.slice(-6).forEach((msg) => {
        if (msg.role && msg.content) {
          conversationMessages.push({
            role: msg.role,
            content: msg.content
          });
        }
      });
    }

    // Add current user question
    conversationMessages.push({
      role: "user",
      content: question
    });

    console.log("--- AZURE OPENAI REQUEST ---");
    const requestBody = {
      messages: conversationMessages,
      max_completion_tokens: azureMaxTokens,
    };
    console.log("Request Body:", JSON.stringify(requestBody, null, 2));

    const startTime = Date.now();
    let completionResponse;

    try {
      completionResponse = await openai.chat.completions.create(requestBody);
      const responseTimeMs = Date.now() - startTime;

      console.log("Azure Response Body:", JSON.stringify(completionResponse, null, 2));
      console.log("AZURE USAGE:", completionResponse.usage);

      // --- Log token usage to azure_token_usage (awaiting) ---
      // model: use value returned by Azure OpenAI API (e.g. gpt-5-mini-2025-08-07) — actual model identifier
      // deployment_name: the Azure deployment resource name from env var
      try {
        await logAzureUsage({
          lead_id: null,
          user_id,
          email: ownerEmailFromBody || null,
          task_type: 'resume_chat',
          product: 'digital_resume',
          model: completionResponse.model || process.env.AZURE_OPENAI_MODEL || azureOpenAiDeployment,
          deployment_name: azureOpenAiDeployment,
          azure_request_id: completionResponse.id || null,
          usage: completionResponse.usage,
          response_time_ms: responseTimeMs,
          is_success: true,
        });
      } catch (loggingError) {
        console.error("Resume chat usage logging failed; returning the AI response:", loggingError);
      }

      const aiResponse = completionResponse.choices[0].message.content;
      return res.status(200).json({ answer: aiResponse });

    } catch (apiError) {
      const responseTimeMs = Date.now() - startTime;
      console.error("Azure OpenAI API Error:", apiError);

      // --- Log failure to azure_token_usage (awaiting) ---
      // On error, no model is returned from API — use AZURE_OPENAI_MODEL env if set, else deployment name as best effort
      try {
        await logAzureUsage({
          lead_id: null,
          user_id,
          email: ownerEmailFromBody || null,
          task_type: 'resume_chat',
          product: 'digital_resume',
          model: process.env.AZURE_OPENAI_MODEL || azureOpenAiDeployment,
          deployment_name: azureOpenAiDeployment,
          azure_request_id: null,
          usage: null,
          response_time_ms: responseTimeMs,
          is_success: false,
          error_message: apiError.message,
        });
      } catch (loggingError) {
        console.error("Resume chat failure logging failed:", loggingError);
      }

      return res.status(502).json({
        status: apiError.status || 502,
        code: apiError.code || "unknown_code",
        message: apiError.message,
        details: apiError.error || null,
        stackTrace: apiError.stack || null
      });
    }

  } catch (error) {
    console.error("Function error:", error);
    return res.status(500).json({
      status: 500,
      code: "internal_server_error",
      message: error.message,
      stackTrace: error.stack
    });
  }
}