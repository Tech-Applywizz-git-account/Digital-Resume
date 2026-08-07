<<<<<<< HEAD
export default async function handler(req, res) {
  // --- CORS headers ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Content-Type", "application/json");

  // --- Handle preflight ---
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // --- Allow only POST ---
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
      allowed: ["POST"],
      received: req.method,
    });
  }

  // --- Parse JSON body ---
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

  const { prompt } = jsonData || {};
  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  // --- Get Azure OpenAI config ---
  const azureApiKey = process.env.AZURE_OPENAI_API_KEY;
  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const azureApiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-12-01-preview";
  const azureDeployment = process.env.AZURE_OPENAI_DEPLOYMENT;

  if (!azureApiKey || !azureEndpoint || !azureDeployment) {
    return res.status(200).json({
      success: true,
      introduction: "This is a mock introduction. Please set AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT, and AZURE_OPENAI_DEPLOYMENT in your environment.",
    });
  }

  // Remove trailing slash from endpoint if present
  const baseUrl = azureEndpoint.replace(/\/+$/, "");
  const url = `${baseUrl}/openai/deployments/${azureDeployment}/chat/completions?api-version=${azureApiVersion}`;

  // --- Call Azure OpenAI API ---
  try {
    const azureResponse = await fetch(url, {
      method: "POST",
      headers: {
        "api-key": azureApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: "You are a professional career coach." },
          { role: "user", content: prompt },
        ],
        max_tokens: 350,
        temperature: 0.7,
      }),
    });

    const data = await azureResponse.json();

    if (!azureResponse.ok) {
      return res.status(500).json({
        error: "Failed to generate introduction",
        azureError: data.error ? data.error.message : "Unknown Azure OpenAI error",
      });
    }

    if (data.choices && data.choices[0]) {
      return res.status(200).json({
        success: true,
        introduction: data.choices[0].message.content,
      });
    } else {
      return res.status(500).json({ error: "No response from Azure OpenAI" });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Failed to generate introduction",
      details: error.message,
    });
  }
=======
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

  const { prompt, ownerId } = jsonData || {};
  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  const azureApiKey = process.env.AZURE_OPENAI_API_KEY;

  if (!azureApiKey) {
    return res.status(200).json({
      success: true,
      introduction: "This is a mock introduction. Please set AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT, and AZURE_OPENAI_DEPLOYMENT in your environment.",
    });
  }

  // --- Retrieve User Info from Supabase ---
  let user_id = null;
  let email = null;
  let lead_id = ownerId || null;

  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (supabaseUrl && supabaseServiceKey) {
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
        const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
        if (user) {
          user_id = user.id;
          email = user.email;
        }
      }
    }
  } catch (err) {
    console.error("Auth retrieval error in generate-introduction:", err);
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

    // Async log success
    logAzureUsage({
      lead_id,
      user_id,
      email,
      task_type: 'generate_introduction',
      source: 'api_generate_introduction',
      model: azureResponse.model || process.env.AZURE_OPENAI_DEPLOYMENT,
      deployment_name: process.env.AZURE_OPENAI_DEPLOYMENT,
      azure_request_id: azureResponse.id || null,
      usage: azureResponse.usage,
      response_time_ms: responseTimeMs,
      is_success: true
    }).catch(e => console.error("Non-blocking log error:", e));

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
    
    // Async log failure
    logAzureUsage({
      lead_id,
      user_id,
      email,
      task_type: 'generate_introduction',
      source: 'api_generate_introduction',
      model: process.env.AZURE_OPENAI_DEPLOYMENT,
      deployment_name: process.env.AZURE_OPENAI_DEPLOYMENT,
      azure_request_id: null,
      usage: null,
      response_time_ms: responseTimeMs,
      is_success: false,
      error_message: apiError.message
    }).catch(e => console.error("Non-blocking log error:", e));

    return res.status(502).json({ 
      status: apiError.status || 502,
      code: apiError.code || "unknown_code",
      message: apiError.message,
      details: apiError.error || null,
      stackTrace: apiError.stack || null
    });
  }
>>>>>>> 4654028 (Implement Azure OpenAI token usage logging)
}