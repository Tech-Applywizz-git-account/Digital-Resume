import { createClient } from "@supabase/supabase-js";

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
    const azureOpenAiEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const azureOpenAiApiKey = process.env.AZURE_OPENAI_API_KEY;
    const azureOpenAiApiVersion = process.env.AZURE_OPENAI_API_VERSION;
    const azureOpenAiDeployment = process.env.AZURE_OPENAI_DEPLOYMENT;
    const useJsonMode = ["1", "true", "yes"].includes((process.env.AZURE_USE_JSON_MODE || "false").toLowerCase());
    const azureMaxTokens = parseInt(process.env.AZURE_MAX_TOKENS || "16000", 10);

    if (!azureOpenAiApiKey) {
      console.error("Missing AZURE_OPENAI_API_KEY");
      return res.status(500).json({ error: "Server configuration error: Missing API Key" });
    }

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

    const { resumeText, messages, question, recruiterMode, ownerId } = body;

    if (!resumeText || !question) {
      return res.status(400).json({ error: "Missing resumeText or question in request body" });
    }

    console.log("Processing question for owner:", ownerId, "recruiterMode:", !!recruiterMode, "history:", messages?.length || 0);

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

    const baseUrl = azureOpenAiEndpoint.replace(/\/+$/, "");
    const azureUrl = `${baseUrl}/openai/deployments/${azureOpenAiDeployment}/chat/completions?api-version=${azureOpenAiApiVersion}`;

    const requestBody = {
      messages: conversationMessages,
      temperature: 0.3,
      max_tokens: azureMaxTokens,
    };

    if (useJsonMode) {
      requestBody.response_format = { type: "json_object" };
    }

    console.log("--- AZURE OPENAI REQUEST ---");
    console.log("Endpoint:", baseUrl);
    console.log("Deployment:", azureOpenAiDeployment);
    console.log("API Version:", azureOpenAiApiVersion);
    console.log("Request Payload:", JSON.stringify(requestBody, null, 2));

    const completionResponse = await fetch(azureUrl, {
      method: "POST",
      headers: {
        "api-key": azureOpenAiApiKey,
        "Content-Type": "application/json",
        "x-client-info": "antigravity"
      },
      body: JSON.stringify(requestBody),
    });

    console.log("Response Status:", completionResponse.status);
    console.log("Response Headers:", Object.fromEntries(completionResponse.headers));

    if (!completionResponse.ok) {
      let errorBody = {};
      const errText = await completionResponse.text();
      try {
        errorBody = JSON.parse(errText);
      } catch (e) {
        errorBody = { message: errText };
      }
      console.error("Azure OpenAI API Error Body:", errorBody);
      
      const azureError = errorBody.error || errorBody;
      
      return res.status(502).json({ 
        error: "Azure OpenAI API Error",
        status: completionResponse.status,
        code: azureError.code || "unknown_code",
        message: azureError.message || errText,
        details: azureError.details || null,
        innerError: azureError.innererror || null
      });
    }

    const data = await completionResponse.json();
    const aiResponse = data.choices[0].message.content;
    const usage = data.usage;

    // --- Log Usage to Database ---
    try {
      const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (supabaseUrl && supabaseServiceKey && usage) {
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

        let targetUserId = ownerId;

        // Fallback to visitor UID only if ownerId is missing
        if (!targetUserId) {
          const authHeader = req.headers.authorization || req.headers.Authorization;
          if (authHeader) {
            const token = authHeader.replace('Bearer ', '');
            const { data: { user } } = await supabaseAdmin.auth.getUser(token);
            targetUserId = user?.id;
          }
        }

        // Calculate Cost (GPT-4o Pricing: $2.50/1M input, $10.00/1M output)
        const inputTokenPrice = 0.0000025;
        const outputTokenPrice = 0.00001;
        const cost = (usage.prompt_tokens * inputTokenPrice) + (usage.completion_tokens * outputTokenPrice);

        console.log(`📊 AI Usage [resume_chat] logged to owner [${targetUserId || 'Anon'}]: ${usage.total_tokens} tokens, Cost: $${cost.toFixed(6)}`);

        const { error: logError } = await supabaseAdmin
          .from('openai_usage_logs')
          .insert({
            user_id: targetUserId,
            feature_name: 'resume_chat',
            prompt_tokens: usage.prompt_tokens,
            completion_tokens: usage.completion_tokens,
            total_tokens: usage.total_tokens,
            cost: cost
          });

        if (logError) console.error("❌ Failed to log AI usage:", logError);
      }
    } catch (logErr) {
      console.error("❌ Usage logging error:", logErr);
    }

    return res.status(200).json({ answer: aiResponse });

  } catch (error) {
    console.error("Function error:", error.message);
    return res.status(500).json({ error: error.message });
  }
}
