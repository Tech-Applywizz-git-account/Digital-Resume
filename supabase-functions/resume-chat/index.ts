import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    // Handle CORS preflight request
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const openAiKey = Deno.env.get("OPENAI_API_KEY");
        if (!openAiKey) {
            console.error("Missing OPENAI_API_KEY");
            // We throw here so it goes to the catch block, but we want to ensure we return JSON
            throw new Error("Server configuration error: Missing API Key");
        }

        // Parse Body
        let body;
        try {
            body = await req.json();
        } catch (e) {
            throw new Error("Invalid request body");
        }

        const { resumeText, messages, question, recruiterMode } = body;

        if (!resumeText || !question) {
            throw new Error("Missing resumeText or question in request body");
        }

        console.log("Processing question with history length:", messages?.length || 0, "recruiterMode:", !!recruiterMode);

        // Build the system prompt based on mode
        let systemPrompt: string;

        if (recruiterMode) {
            // ✅ RECRUITER-FRIENDLY FIRST-PERSON PROMPT
            systemPrompt = `You ARE the person described in this resume. You are responding to a recruiter or hiring manager who is viewing your portfolio and wants to learn more about you.

RESUME (your background):
-------------------
${resumeText.slice(0, 25000)}
-------------------

CRITICAL RULES:
1. **Always respond in FIRST PERSON** — "I have experience in...", "My role at...", "I built...", etc.
2. **Professional & Confident Tone** — Speak like a top candidate who knows their worth. Be articulate, direct, and confident without being arrogant.
3. **Recruiter-Friendly** — Assume the person asking is a recruiter or hiring manager. Tailor responses to demonstrate value, impact, and fit.
4. **Slightly Playful for Personal Questions** — If asked fun/casual questions (hobbies, fun facts, etc.), be warm, personable, and add a touch of personality. Keep it professional but human.
5. **Contact Details** — If asked how to reach you, provide the email, phone, LinkedIn, or other contact info EXACTLY as listed on the resume. Do NOT fabricate contact info.
6. **No Hallucinations** — Only reference skills, roles, projects, and experiences that appear in the resume. Never make up information.
7. **Quantify Impact** — When discussing achievements, mention specific metrics, numbers, or outcomes if they appear in the resume.
8. **Format** — Use Markdown formatting. Use bullet points for lists. Keep responses concise but thorough.
9. **Follow-up Suggestions**: At the very end of your response, strictly output a line starting with "SUGGESTED_QUESTIONS:" followed by 3 short, relevant follow-up questions separated by a pipe character "|".

Example responses:
- Q: "Tell me about yourself" → "I'm a [role] with [X] years of experience in [domains]. Currently, I [current/recent role]. I'm passionate about [key areas]..."
- Q: "What are your strengths?" → "My core strengths lie in [skills]. In my recent role at [company], I [specific achievement with metrics]..."
- Q: "Can I contact you?" → "Absolutely! You can reach me at [email] or connect with me on LinkedIn at [URL]."

Example end of response:
SUGGESTED_QUESTIONS: What was your biggest project?|What tech stack do you prefer?|Are you open to relocation?`;
        } else {
            // ✅ ORIGINAL ANALYSIS PROMPT (third-person)
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

        const completionResponse = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${openAiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: conversationMessages,
                temperature: 0.3,
            }),
        });

        if (!completionResponse.ok) {
            const errText = await completionResponse.text();
            console.error("OpenAI API Error:", errText);
            throw new Error(`OpenAI API Error: ${completionResponse.statusText}`);
        }

        const data = await completionResponse.json();
        const aiResponse = data.choices[0].message.content;

        return new Response(
            JSON.stringify({ answer: aiResponse }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200
            },
        );

    } catch (error) {
        console.error("Function error:", error.message);
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 400, // Return 400 (or 500) so the client knows it failed
            },
        );
    }
});
