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
  const azureApiVersion = process.env.AZURE_OPENAI_API_VERSION;
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
    const requestPayload = {
      messages: [
        { role: "system", content: "You are a professional career coach." },
        { role: "user", content: prompt },
      ],
      max_tokens: 350,
      temperature: 0.7,
    };

    console.log("--- AZURE OPENAI REQUEST ---");
    console.log("Endpoint:", baseUrl);
    console.log("Deployment:", azureDeployment);
    console.log("API Version:", azureApiVersion);
    console.log("Request Payload:", JSON.stringify(requestPayload, null, 2));

    const azureResponse = await fetch(url, {
      method: "POST",
      headers: {
        "api-key": azureApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestPayload),
    });

    console.log("Response Status:", azureResponse.status);
    console.log("Response Headers:", Object.fromEntries(azureResponse.headers));

    if (!azureResponse.ok) {
      let errorBody = {};
      const errText = await azureResponse.text();
      try {
        errorBody = JSON.parse(errText);
      } catch (e) {
        errorBody = { message: errText };
      }
      console.error("Azure OpenAI API Error Body:", errorBody);
      
      const azureError = errorBody.error || errorBody;
      
      return res.status(500).json({
        error: "Azure OpenAI API Error",
        status: azureResponse.status,
        code: azureError.code || "unknown_code",
        message: azureError.message || errText,
        details: azureError.details || null,
        innerError: azureError.innererror || null
      });
    }

    const data = await azureResponse.json();
    if (data.choices && data.choices[0]) {
      return res.status(200).json({
        success: true,
        introduction: data.choices[0].message.content,
      });
    } else {
      return res.status(500).json({ error: "No response from Azure OpenAI", data });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Failed to generate introduction",
      details: error.message,
    });
  }
}