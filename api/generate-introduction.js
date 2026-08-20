import { createClient } from "@supabase/supabase-js";
import { AzureOpenAI } from "openai";
import { logAzureUsage } from "./utils/tokenLogger.js";

export default async function handler(req, res) {
  // --- CORS headers ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
      allowed: ["POST"],
      received: req.method,
    });
  }

  let jsonData;
  try {
    if (req.body && typeof req.body === 'object') {
      jsonData = req.body;
    } else {
      const buffers = [];
      for await (const chunk of req) buffers.push(chunk);
      const rawBody = Buffer.concat(buffers).toString();
      jsonData = JSON.parse(rawBody);
    }
  } catch (err) {
    return res.status(400).json({
      error: "Invalid JSON in request body",
      details: err.message,
    });
  }

  const { prompt, ownerId, ownerEmail, taskType } = jsonData || {};
  // Validate task_type: allow only known safe values to prevent injection
  const VALID_TASK_TYPES = ['generate_introduction', 'rerecording'];
  const resolved_task_type = VALID_TASK_TYPES.includes(taskType) ? taskType : 'generate_introduction';

  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  const azureApiKey = process.env.AZURE_OPENAI_API_KEY;
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;

  if (!azureApiKey || !endpoint || !apiVersion || !deployment) {
    return res.status(500).json({
      success: false,
      error: "Azure OpenAI configuration is missing on the server.",
    });
  }

  // --- Resolve user_id for token logging ---
  // Primary:  ownerId sent by frontend
  // Fallback: look up user_id via ownerEmail in digital_resume_by_crm
  let user_id = ownerId || null;

  if (!user_id && ownerEmail) {
    try {
      const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (supabaseUrl && supabaseServiceKey) {
        const { createClient } = await import("@supabase/supabase-js");
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
        const { data: crmUser } = await supabaseAdmin
          .from('digital_resume_by_crm')
          .select('user_id')
          .eq('email', ownerEmail.trim().toLowerCase())
          .maybeSingle();
        if (crmUser?.user_id) {
          user_id = crmUser.user_id;
          console.log(`✅ generate-introduction: Resolved user_id via ownerEmail fallback: ${user_id}`);
        } else {
          console.warn(`⚠️ generate-introduction: No CRM record for ownerEmail="${ownerEmail}". Token usage will NOT be logged.`);
        }
      }
    } catch (lookupErr) {
      console.error("❌ generate-introduction: Email→user_id fallback lookup failed:", lookupErr?.message);
    }
  }

  const openai = new AzureOpenAI({
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION,
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
  });

  const requestPayload = {
    messages: [
      { role: "system", content: "You are a professional career coach." },
      { role: "user", content: prompt },
    ],
    max_completion_tokens: process.env.AZURE_MAX_TOKENS ? parseInt(process.env.AZURE_MAX_TOKENS, 10) : 800,
  };

  const startTime = Date.now();
  let azureResponse;

  try {
    azureResponse = await openai.chat.completions.create(requestPayload);
    const responseTimeMs = Date.now() - startTime;

    console.log("AZURE USAGE:", azureResponse.usage);

    // Await log success
    await logAzureUsage({
      lead_id: null,
      user_id,
      task_type: resolved_task_type,
      model: azureResponse.model || process.env.AZURE_OPENAI_DEPLOYMENT,
      deployment_name: process.env.AZURE_OPENAI_DEPLOYMENT,
      azure_request_id: azureResponse.id || null,
      usage: azureResponse.usage,
      response_time_ms: responseTimeMs,
      is_success: true
    });

    if (azureResponse.choices && azureResponse.choices[0]) {
      return res.status(200).json({
        success: true,
        introduction: azureResponse.choices[0].message.content,
      });
    } else {
      return res.status(500).json({ 
        status: 500,
        code: "invalid_response",
        message: "No choices returned from Azure OpenAI",
        data: azureResponse 
      });
    }

  } catch (apiError) {
    const responseTimeMs = Date.now() - startTime;
    
    // Await log failure
    await logAzureUsage({
      lead_id: null,
      user_id,
      task_type: resolved_task_type,
      model: process.env.AZURE_OPENAI_DEPLOYMENT,
      deployment_name: process.env.AZURE_OPENAI_DEPLOYMENT,
      azure_request_id: null,
      usage: null,
      response_time_ms: responseTimeMs,
      is_success: false,
      error_message: apiError.message
    });

    return res.status(502).json({ 
      status: apiError.status || 502,
      code: apiError.code || "unknown_code",
      message: apiError.message,
      details: apiError.error || null
    });
  }
}