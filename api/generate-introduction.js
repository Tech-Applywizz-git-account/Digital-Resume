import { AzureOpenAI } from "openai";

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

  const azureApiKey = process.env.AZURE_OPENAI_API_KEY;

  if (!azureApiKey) {
    return res.status(200).json({
      success: true,
      introduction: "This is a mock introduction. Please set AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT, and AZURE_OPENAI_DEPLOYMENT in your environment.",
    });
  }

  const openai = new AzureOpenAI({
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION,
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
  });

  // --- Call Azure OpenAI API ---
  try {
    const requestPayload = {
      messages: [
        { role: "system", content: "You are a professional career coach." },
        { role: "user", content: prompt },
      ],
      max_completion_tokens: process.env.AZURE_MAX_TOKENS ? parseInt(process.env.AZURE_MAX_TOKENS, 10) : 800,
    };

    console.log("--- AZURE OPENAI REQUEST ---");
    console.log("Request Body:", JSON.stringify(requestPayload, null, 2));

    let azureResponse;
    try {
      azureResponse = await openai.chat.completions.create(requestPayload);
    } catch (apiError) {
      console.error("Azure OpenAI API Error:", apiError);
      return res.status(500).json({ 
        status: apiError.status || 500,
        code: apiError.code || "unknown_code",
        message: apiError.message,
        details: apiError.error || null,
        stackTrace: apiError.stack || null
      });
    }

    console.log("Azure Response Body:", JSON.stringify(azureResponse, null, 2));
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
  } catch (error) {
    return res.status(500).json({
      status: 500,
      code: "internal_server_error",
      message: error.message,
      stackTrace: error.stack
    });
  }
}