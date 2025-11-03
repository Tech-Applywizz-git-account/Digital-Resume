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

  if (req.method === "GET") {
    return res.status(200).json({ 
      message: "Test API is working",
      method: req.method,
      timestamp: new Date().toISOString()
    });
  }

  if (req.method === "POST") {
    try {
      // --- Parse JSON body (fix for request.json is not a function) ---
      const buffers = [];
      for await (const chunk of req) buffers.push(chunk);
      const rawBody = Buffer.concat(buffers).toString();
      const data = JSON.parse(rawBody);
      
      return res.status(200).json({ 
        message: "Test POST successful",
        received: data,
        method: req.method,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      return res.status(400).json({ 
        error: "Invalid JSON",
        message: error.message
      });
    }
  }

  return res.status(405).json({ 
    error: "Method not allowed",
    allowed: ["GET", "POST"],
    received: req.method
  });
}