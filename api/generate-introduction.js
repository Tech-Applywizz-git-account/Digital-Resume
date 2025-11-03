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

  // --- Parse JSON body (fix for request.json is not a function) ---
  let jsonData;
  try {
    const buffers = [];
    for await (const chunk of req) buffers.push(chunk);
    const rawBody = Buffer.concat(buffers).toString();
    jsonData = JSON.parse(rawBody);
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

  // --- Get API key ---
  const openaiApiKey = process.env.VITE_OPENAI_API_KEY;

  if (!openaiApiKey) {
    return res.status(200).json({
      success: true,
      introduction: "This is a mock introduction. Please set VITE_OPENAI_API_KEY in your environment.",
    });
  }

  // --- Call OpenAI API ---
  try {
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a professional career coach." },
          { role: "user", content: prompt },
        ],
        max_tokens: 350,
        temperature: 0.7,
      }),
    });

    const data = await openaiResponse.json();

    if (!openaiResponse.ok) {
      return res.status(500).json({
        error: "Failed to generate introduction",
        openaiError: data.error ? data.error.message : "Unknown OpenAI error",
      });
    }

    if (data.choices && data.choices[0]) {
      return res.status(200).json({
        success: true,
        introduction: data.choices[0].message.content,
      });
    } else {
      return res.status(500).json({ error: "No response from OpenAI" });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Failed to generate introduction",
      details: error.message,
    });
  }
}
