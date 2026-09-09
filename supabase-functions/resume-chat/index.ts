import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: any) => {
    // Handle CORS preflight request
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const azureOpenAiEndpoint = Deno.env.get("AZURE_OPENAI_ENDPOINT");
        const azureOpenAiApiKey = Deno.env.get("AZURE_OPENAI_API_KEY");
        const azureOpenAiApiVersion = Deno.env.get("AZURE_OPENAI_API_VERSION");
        const azureOpenAiDeployment = Deno.env.get("AZURE_OPENAI_DEPLOYMENT");
        const azureMaxTokens = parseInt(Deno.env.get("AZURE_MAX_TOKENS") || "800", 10);

        if (!azureOpenAiApiKey) {
            console.error("Missing AZURE_OPENAI_API_KEY");
            throw new Error("Server configuration error: Missing API Key");
        }

        // Parse Body
        let body;
        try {
            body = await req.json();
        } catch (e) {
            throw new Error("Invalid request body");
        }

        // ✅ ownerId passed from frontend ensures tracking works for anon visitors
        const { resumeText, messages, question, recruiterMode, ownerId } = body;

        if (!resumeText || !question) {
            throw new Error("Missing resumeText or question in request body");
        }

        console.log("Processing question for owner:", ownerId, "recruiterMode:", !!recruiterMode, "history:", messages?.length || 0);

        // Build the system prompt based on mode
        let systemPrompt: string;

        if (recruiterMode) {
            // ✅ YOUR FULL LONG RECRUITER-FRIENDLY PROMPT (10 Rules)
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
            // ✅ YOUR ORIGINAL THIRD-PERSON ANALYSIS PROMPT
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
            messages.slice(-6).forEach((msg: any) => {
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

        const azureUrl = `${azureOpenAiEndpoint}/openai/deployments/${azureOpenAiDeployment}/chat/completions?api-version=${azureOpenAiApiVersion}`;

        const requestBody: any = {
            messages: conversationMessages,
            max_completion_tokens: azureMaxTokens,
        };

        const completionResponse = await fetch(azureUrl, {
            method: "POST",
            headers: {
                "api-key": azureOpenAiApiKey,
                "Content-Type": "application/json",
                "x-client-info": "antigravity"
            },
            body: JSON.stringify(requestBody),
        });

        if (!completionResponse.ok) {
            const errText = await completionResponse.text();
            console.error("Azure OpenAI API Error:", errText);
            throw new Error(`Azure OpenAI API Error: ${completionResponse.statusText}`);
        }

        const data = await completionResponse.json();
        const aiResponse = data.choices[0].message.content;
        const usage = data.usage;

        // --- Log Usage to Database ---
        try {
            const supabaseUrl = Deno.env.get("SUPABASE_URL");
            const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

            if (supabaseUrl && supabaseServiceKey && usage) {
                const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

                // Identify target user. Prioritize the resume owner (passed in body so anon chats work)
                let targetUserId = ownerId;

                // Fallback to visitor UID only if ownerId is missing
                if (!targetUserId) {
                    const authHeader = req.headers.get('Authorization');
                    if (authHeader) {
                        const token = authHeader.replace('Bearer ', '');
                        const { data: { user } } = await supabaseAdmin.auth.getUser(token);
                        targetUserId = user?.id;
                    }
                }

        // --- Log token usage to azure_token_usage ---
        // model: use value returned by Azure OpenAI API (actual model identifier, e.g. gpt-5-mini-2025-08-07)
        // deployment_name: the Azure deployment resource name from AZURE_OPENAI_DEPLOYMENT
        const task_date = new Date().toISOString().split('T')[0];
        const inputTokens = usage?.prompt_tokens || 0;
        const outputTokens = usage?.completion_tokens || 0;
        const totalTokens = usage?.total_tokens || 0;

        let resolvedEmail: string | null = null;
        if (targetUserId) {
            const { data: crmData } = await supabaseAdmin
                .from('digital_resume_by_crm')
                .select('email')
                .eq('user_id', targetUserId)
                .maybeSingle();
            resolvedEmail = crmData?.email?.trim().toLowerCase() || null;

            if (!resolvedEmail) {
                const { data: profData } = await supabaseAdmin
                    .from('profiles')
                    .select('email')
                    .eq('id', targetUserId)
                    .maybeSingle();
                resolvedEmail = profData?.email?.trim().toLowerCase() || null;
            }
        }

        if (!resolvedEmail) {
            console.warn(`⚠️ [resume_chat] No email resolved for targetUserId="${targetUserId}". Skipping token log (email column is NOT NULL).`);
        } else {
            const modelToLog = data.model || Deno.env.get("AZURE_OPENAI_MODEL") || azureOpenAiDeployment;
            const { error: rpcErr } = await supabaseAdmin.rpc("upsert_azure_token_usage", {
                p_lead_id: null,
                p_user_id: targetUserId,
                p_email: resolvedEmail,
                p_task_date: task_date,
                p_task_type: 'resume_chat',
                p_source: 'Azure OpenAI',
                p_model: modelToLog,
                p_deployment_name: azureOpenAiDeployment,
                p_azure_request_id: data.id || null,
                p_total_input_tokens: inputTokens,
                p_total_output_tokens: outputTokens,
                p_total_completion_tokens: totalTokens,
                p_api_input_tokens_list: String(inputTokens),
                p_api_output_tokens_list: String(outputTokens),
                p_api_completion_tokens: String(totalTokens),
                p_response_time_ms: null,
                p_is_success: true,
                p_error_message: null,
                p_product: 'digital_resume',
            });

            if (rpcErr) {
                console.warn("⚠️ RPC upsert failed, falling back to direct table upsert:", rpcErr.message);
                const { error: logError } = await supabaseAdmin
                    .from('azure_token_usage')
                    .upsert({
                        user_id: targetUserId || null,
                        email: resolvedEmail,
                        product: 'digital_resume',
                        task_date: task_date,
                        task_type: 'resume_chat',
                        source: 'Azure OpenAI',
                        model: modelToLog,
                        deployment_name: azureOpenAiDeployment,
                        azure_request_id: data.id || null,
                        total_input_tokens: inputTokens,
                        total_output_tokens: outputTokens,
                        total_completion_tokens: totalTokens,
                        api_input_tokens_list: String(inputTokens),
                        api_output_tokens_list: String(outputTokens),
                        api_completion_tokens: String(totalTokens),
                        response_time_ms: null,
                        is_success: true,
                        error_message: null,
                    }, {
                        onConflict: 'user_id,task_type,task_date',
                        ignoreDuplicates: false,
                    });
                if (logError) console.error("❌ Failed to log AI usage to azure_token_usage:", logError);
                else console.log(`📊 AI Usage [resume_chat] logged to azure_token_usage for owner [${targetUserId}]: ${totalTokens} tokens`);
            } else {
                console.log(`📊 AI Usage [resume_chat] logged via RPC to azure_token_usage for owner [${targetUserId}]: ${totalTokens} tokens`);
            }
        }

            }
        } catch (logErr) {
            console.error("❌ Usage logging error:", logErr);
            // Don't fail the main request if logging fails
        }

        return new Response(
            JSON.stringify({ answer: aiResponse }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200
            },
        );

    } catch (error: any) {
        console.error("Function error:", error.message);
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 400,
            },
        );
    }
});
