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

  if (!azureApiKey) {
    return res.status(200).json({
      success: true,
      introduction: "This is a mock introduction. Please set AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT, and AZURE_OPENAI_DEPLOYMENT in your environment.",
    });
  }

  const missingAzureConfig = [
    !endpoint && "AZURE_OPENAI_ENDPOINT",
    !apiVersion && "AZURE_OPENAI_API_VERSION",
    !deployment && "AZURE_OPENAI_DEPLOYMENT",
  ].filter(Boolean);

  if (missingAzureConfig.length > 0) {
    return res.status(500).json({
      success: false,
      error: "Azure OpenAI configuration is missing on the server.",
      missing: missingAzureConfig,
    });
  }

  // --- Resolve user_id and email for token logging ---
  // Primary:  ownerId / ownerEmail sent by frontend
  let user_id = ownerId || null;
  let email = ownerEmail || null;

  // Fallback 1: check Auth header if user_id or email is missing
  if (!user_id || !email) {
    try {
      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (supabaseUrl && supabaseServiceKey) {
          const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
          const { data: { user } } = await supabaseAdmin.auth.getUser(token);
          if (user) {
            if (!user_id) user_id = user.id;
            if (!email) email = user.email;
          }
        }
      }
    } catch (authErr) {
      console.warn("Auth header lookup warning in generate-introduction:", authErr?.message);
    }
  }

  // Fallback 2: look up user_id via email in digital_resume_by_crm
  if (!user_id && email) {
    try {
      const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (supabaseUrl && supabaseServiceKey) {
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
        const { data: crmUser } = await supabaseAdmin
          .from('digital_resume_by_crm')
          .select('user_id')
          .eq('email', email.trim().toLowerCase())
          .maybeSingle();
        if (crmUser?.user_id) {
          user_id = crmUser.user_id;
          console.log(`✅ generate-introduction: Resolved user_id via email fallback: ${user_id}`);
        } else {
          console.warn(`⚠️ generate-introduction: No CRM record for email="${email}". Token usage will NOT be logged.`);
        }
      }
    } catch (lookupErr) {
      console.error("❌ generate-introduction: Email→user_id fallback lookup failed:", lookupErr?.message);
    }
  }

  const openai = new AzureOpenAI({
    endpoint: endpoint,
    apiKey: azureApiKey,
    apiVersion: apiVersion,
    deployment: deployment,
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
    try {
      await logAzureUsage({
        lead_id: null,
        user_id,
        email: email || null,
        task_type: resolved_task_type,
        product: 'digital_resume',
        model: azureResponse.model || process.env.AZURE_OPENAI_MODEL || deployment,
        deployment_name: deployment,
        azure_request_id: azureResponse.id || null,
        usage: azureResponse.usage,
        response_time_ms: responseTimeMs,
        is_success: true
      });
    } catch (loggingError) {
      console.error("Introduction usage logging error:", loggingError);
    }

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
    console.error("Azure OpenAI API Error in generate-introduction:", apiError);
    
    // Await log failure
    try {
      await logAzureUsage({
        lead_id: null,
        user_id,
        email: email || null,
        task_type: resolved_task_type,
        product: 'digital_resume',
        model: process.env.AZURE_OPENAI_MODEL || deployment,
        deployment_name: deployment,
        azure_request_id: null,
        usage: null,
        response_time_ms: responseTimeMs,
        is_success: false,
        error_message: apiError.message
      });
    } catch (loggingError) {
      console.error("Introduction failure logging error:", loggingError);
    }

    return res.status(502).json({ 
      status: apiError.status || 502,
      code: apiError.code || "unknown_code",
      message: apiError.message,
      details: apiError.error || null,
      stackTrace: apiError.stack || null
    });
  }
}